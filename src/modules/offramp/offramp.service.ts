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
  CryptoTxStatus,
  SwapRecord,
  SwapRecordStatus,
  SwapRecordType,
} from '../../database/entities';
import { CreateOfframpDto } from './dto';
import { WalletsService } from '../wallets/wallets.service';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';

@Injectable()
export class OfframpService {
  private readonly logger = new Logger(OfframpService.name);
  private readonly FEE_PERCENT = 1.5;

  constructor(
    @InjectRepository(CryptoTransaction)
    private readonly txRepo: Repository<CryptoTransaction>,
    @InjectRepository(SwapRecord)
    private readonly swapRecordRepo: Repository<SwapRecord>,
    private readonly walletsService: WalletsService,
    private readonly cc: CoincircuitService,
  ) {}

  async getRate(mode: 'live' | 'test', pair: string) {
    const [base, quote] = pair.toUpperCase().split('_');
    if (!base || !quote) {
      throw new BadRequestException('Invalid pair format. Use e.g. USDT_NGN');
    }

    const estimate = await this.cc.estimateSwap(mode, {
      fromCurrency: base,
      toCurrency: quote,
      amount: '1',
    });

    const baseRate = Number(estimate.data?.targetAmount ?? 0);
    const feeAdjustedRate = baseRate * (1 - this.FEE_PERCENT / 100);

    return {
      pair: `${base}/${quote}`,
      rate: feeAdjustedRate,
      base_rate: baseRate,
      platform_fee_percent: this.FEE_PERCENT,
      valid_for_seconds: 30,
      timestamp: new Date().toISOString(),
    };
  }

  async create(businessId: string, mode: 'live' | 'test', dto: CreateOfframpDto) {
    // 1. Get CC swap quotation (crypto → NGN)
    let quotation: any;
    let swap: any;
    try {
      const quotationResult = await this.cc.createSwapQuotation(mode, {
        fromCurrency: String(dto.crypto_asset).toUpperCase(),
        toCurrency: 'NGN',
        amount: dto.crypto_amount.toString(),
      });
      quotation = quotationResult.data;

      // 2. Execute swap immediately against the quotation
      const swapResult = await this.cc.executeSwap(mode, quotation.id);
      swap = swapResult.data;
    } catch (err) {
      this.logger.error(`Offramp swap failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to initiate offramp swap with provider.',
      );
    }

    // 3. Estimate payout from quotation (actual amount confirmed via swap.completed webhook)
    const estimatedGrossNgn = Number(quotation.targetAmount ?? 0);
    const estimatedFeeNgn = estimatedGrossNgn * (this.FEE_PERCENT / 100);
    const estimatedNetNgn = estimatedGrossNgn - estimatedFeeNgn;

    // 4. Save SwapRecord — webhook uses type=OFFRAMP to trigger auto-payout
    await this.swapRecordRepo.save(
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
          feePercent: this.FEE_PERCENT,
        },
      }),
    );

    // 5. Save CryptoTransaction — outbound crypto record
    const tx = this.txRepo.create({
      business_id: businessId,
      direction: CryptoTxDirection.OUTBOUND,
      crypto_asset: dto.crypto_asset as any,
      crypto_amount: dto.crypto_amount,
      fiat_amount: estimatedNetNgn || null,
      fiat_currency: 'NGN',
      fee: estimatedFeeNgn,
      exchange_rate: estimatedGrossNgn / dto.crypto_amount || null,
      status: CryptoTxStatus.INITIATED,
      provider_reference: swap.id,
      metadata: { quotationId: quotation.id, ...(dto.metadata || {}) },
      description: `Offramp ${dto.crypto_amount} ${dto.crypto_asset} → ~₦${estimatedNetNgn.toFixed(2)}`,
    });

    const saved = await this.txRepo.save(tx);
    this.logger.log(`Offramp initiated: swap=${swap.id} tx=${saved.id}`);
    return saved;
  }

  async findOne(businessId: string, txId: string) {
    const tx = await this.txRepo.findOne({
      where: {
        id: txId,
        business_id: businessId,
        direction: CryptoTxDirection.OUTBOUND,
      },
    });
    if (!tx) throw new NotFoundException('Offramp transaction not found.');
    return tx;
  }
}
