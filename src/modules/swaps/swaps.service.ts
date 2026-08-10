import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { SwapRecord, SwapRecordStatus } from '../../database/entities';
import { EstimateSwapDto, CreateSwapQuotationDto, SwapQueryDto } from './dto';

interface CCSwapData {
  id: string;
  fromCurrency?: string;
  toCurrency?: string;
  sourceAmount?: string | number;
  targetAmount?: string | number | null;
  status?: string;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class SwapsService {
  private readonly logger = new Logger(SwapsService.name);

  constructor(
    private readonly cc: CoincircuitService,
    @InjectRepository(SwapRecord)
    private readonly swapRecordRepo: Repository<SwapRecord>,
  ) {}

  estimate(mode: 'live' | 'test', dto: EstimateSwapDto) {
    return this.cc.estimateSwap(mode, {
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      amount: dto.amount,
    });
  }

  createQuotation(mode: 'live' | 'test', dto: CreateSwapQuotationDto) {
    return this.cc.createSwapQuotation(mode, {
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      amount: dto.amount,
    });
  }

  getQuotation(mode: 'live' | 'test', quotationId: string) {
    return this.cc.getSwapQuotation(mode, quotationId);
  }

  async executeQuotation(
    businessId: string,
    mode: 'live' | 'test',
    quotationId: string,
  ) {
    const result = await this.cc.executeSwap(mode, quotationId, {
      webhookUrl:
        'https://api.dexxify.com/api/v1/webhooks/incoming/coincircuit',
    });

    const swap = result?.data as CCSwapData | undefined;
    if (swap?.id) {
      try {
        await this.swapRecordRepo.save(
          this.swapRecordRepo.create({
            business_id: businessId,
            mode,
            cc_swap_id: swap.id,
            from_currency: swap.fromCurrency,
            to_currency: swap.toCurrency,
            source_amount: Number(swap.sourceAmount),
            target_amount:
              swap.targetAmount != null ? Number(swap.targetAmount) : null,
            status:
              swap.status === 'completed'
                ? SwapRecordStatus.COMPLETED
                : SwapRecordStatus.PENDING,
          }),
        );
      } catch (err) {
        this.logger.warn(
          `Failed to save swap record for ${swap.id}: ${getErrorMessage(err)}`,
        );
      }
    }

    return result;
  }

  list(mode: 'live' | 'test', query: SwapQueryDto) {
    const params: Record<string, string> = {};
    if (query.page) params.page = String(query.page);
    if (query.size) params.size = String(query.size);
    if (query.fromCurrency) params.fromCurrency = query.fromCurrency;
    if (query.toCurrency) params.toCurrency = query.toCurrency;
    if (query.startDate) params.startDate = query.startDate;
    if (query.endDate) params.endDate = query.endDate;
    return this.cc.listSwaps(mode, params);
  }

  findOne(mode: 'live' | 'test', id: string) {
    return this.cc.getSwap(mode, id);
  }
}
