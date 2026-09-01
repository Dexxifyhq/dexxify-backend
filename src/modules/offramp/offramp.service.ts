import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CryptoTransaction,
  CryptoTxDirection,
  SwapRecord,
  SwapRecordStatus,
  SwapRecordType,
} from '../../database/entities';
import {
  FIAT_WITHDRAWAL_FEE,
  STABLECOIN_FEE,
} from '../../common/constants/fees.constants';
import { CreateOfframpDto } from './dto';
import { WalletsService } from '../wallets/wallets.service';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';

interface SwapEstimateData {
  targetAmount?: string | number;
}

interface SwapQuotationData {
  id: string;
  targetAmount?: string | number;
}

interface SwapExecutionData {
  id: string;
}

@Injectable()
export class OfframpService {
  private readonly logger = new Logger(OfframpService.name);

  constructor(
    @InjectRepository(CryptoTransaction)
    private readonly txRepo: Repository<CryptoTransaction>,
    @InjectRepository(SwapRecord)
    private readonly swapRecordRepo: Repository<SwapRecord>,
    private readonly walletsService: WalletsService,
    private readonly cc: CoincircuitService,
  ) {}

  // NOT CURRENTLY IN USE
  async getRate(mode: 'live' | 'test', pair: string) {
    const [base, quote] = pair.toUpperCase().split('_');
    if (!base || !quote) {
      throw new BadRequestException('Invalid pair format. Use e.g. USDT_NGN');
    }

    const estimate = (await this.cc.estimateSwap(mode, {
      fromCurrency: base,
      toCurrency: quote,
      amount: '1',
    })) as { data: SwapEstimateData };

    const baseRate = Number(estimate.data?.targetAmount ?? 0);
    const fee =
      quote === 'USDT' || quote === 'USDC'
        ? Number(STABLECOIN_FEE)
        : Number(FIAT_WITHDRAWAL_FEE);
    const feeAdjustedRate = baseRate + fee;

    return {
      pair: `${base}/${quote}`,
      rate: feeAdjustedRate,
      base_rate: baseRate,
      platform_fee: fee,
      valid_for_seconds: 15,
      timestamp: new Date().toISOString(),
    };
  }

  async create(
    businessId: string,
    mode: 'live' | 'test',
    dto: CreateOfframpDto,
  ) {
    // 1. Get CC swap quotation (crypto → NGN)
    let quotation: SwapQuotationData;
    let swap: SwapExecutionData;
    try {
      const quotationResult = (await this.cc.createSwapQuotation(mode, {
        fromCurrency: String(dto.crypto_asset).toUpperCase(),
        toCurrency: 'NGN',
        amount: dto.crypto_amount.toString(),
      })) as { data: SwapQuotationData };
      quotation = quotationResult.data;
      // console.log('result', quotationResult);

      // 2. Execute swap immediately against the quotation
      const swapResult = (await this.cc.executeSwap(mode, quotation.id, {
        webhookUrl:
          'https://api.dexxify.com/api/v1/webhooks/incoming/coincircuit',
      })) as {
        data: SwapExecutionData;
      };
      swap = swapResult.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Offramp swap failed: ${message}`);
      throw new BadRequestException(
        'Failed to initiate offramp swap with provider.',
      );
    }

    // 3. Estimate payout from quotation (actual amount confirmed via swap.completed webhook)
    const estimatedGrossNgn = Number(quotation.targetAmount ?? 0);

    // 4. Save SwapRecord — webhook uses type=OFFRAMP to trigger auto-payout.
    // The outbound CryptoTransaction is created later, in
    // CoincircuitWebhooksService.triggerOfframpPayout
    const record = await this.swapRecordRepo.save(
      this.swapRecordRepo.create({
        business_id: businessId,
        mode,
        cc_swap_id: swap.id,
        from_currency: String(dto.crypto_asset).toUpperCase(),
        to_currency: 'NGN',
        source_amount: dto.crypto_amount,
        target_amount: estimatedGrossNgn || null,
        status: SwapRecordStatus.PENDING,
        type: SwapRecordType.OFFRAMP,
        metadata: {
          recipientId: dto.recipient_id,
          quotationId: quotation.id,
          ...(dto.metadata || {}),
        },
      }),
    );

    this.logger.log(`Offramp initiated: swap=${swap.id} record=${record.id}`);
    return record;
  }

  /**
   * `id` is the SwapRecord id returned by create() — the one stable
   * identifier for the whole offramp lifecycle.
   */
  async findOne(businessId: string, id: string) {
    const record = await this.swapRecordRepo.findOne({
      where: {
        id,
        business_id: businessId,
        type: SwapRecordType.OFFRAMP,
      },
    });
    if (!record) throw new NotFoundException('Offramp transaction not found.');

    const transaction = await this.txRepo
      .createQueryBuilder('tx')
      .where('tx.business_id = :businessId', { businessId })
      .andWhere('tx.direction = :direction', {
        direction: CryptoTxDirection.OUTBOUND,
      })
      .andWhere('tx.metadata @> :meta', {
        meta: JSON.stringify({ swapRecordId: record.id }),
      })
      .getOne();

    return {
      id: record.id,
      status: transaction?.status ?? record.status,
      swap: record,
      transaction: transaction ?? null,
    };
  }
}
