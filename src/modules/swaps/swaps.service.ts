import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { SwapRecord, SwapRecordStatus } from '../../database/entities';
import {
  EstimateSwapDto,
  CreateSwapQuotationDto,
  SwapQueryDto,
} from './dto';

@Injectable()
export class SwapsService {
  private readonly logger = new Logger(SwapsService.name);

  constructor(
    private readonly cc: CoincircuitService,
    @InjectRepository(SwapRecord)
    private readonly swapRecordRepo: Repository<SwapRecord>,
  ) {}

  estimate(dto: EstimateSwapDto) {
    return this.cc.estimateSwap({
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      amount: dto.amount,
    });
  }

  createQuotation(dto: CreateSwapQuotationDto) {
    return this.cc.createSwapQuotation({
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      amount: dto.amount,
    });
  }

  getQuotation(quotationId: string) {
    return this.cc.getSwapQuotation(quotationId);
  }

  async executeQuotation(developerId: string, quotationId: string) {
    const result = await this.cc.executeSwap(quotationId);

    const swap = result?.data;
    if (swap?.id) {
      try {
        await this.swapRecordRepo.save(
          this.swapRecordRepo.create({
            developer_id: developerId,
            cc_swap_id: swap.id,
            from_currency: swap.fromCurrency,
            to_currency: swap.toCurrency,
            source_amount: Number(swap.sourceAmount),
            target_amount: swap.targetAmount != null ? Number(swap.targetAmount) : null,
            status: swap.status === 'completed'
              ? SwapRecordStatus.COMPLETED
              : SwapRecordStatus.PENDING,
          }),
        );
      } catch (err) {
        this.logger.warn(`Failed to save swap record for ${swap.id}: ${err.message}`);
      }
    }

    return result;
  }

  list(query: SwapQueryDto) {
    const params: Record<string, string> = {};
    if (query.page) params.page = String(query.page);
    if (query.size) params.size = String(query.size);
    if (query.fromCurrency) params.fromCurrency = query.fromCurrency;
    if (query.toCurrency) params.toCurrency = query.toCurrency;
    if (query.startDate) params.startDate = query.startDate;
    if (query.endDate) params.endDate = query.endDate;
    return this.cc.listSwaps(params);
  }

  findOne(id: string) {
    return this.cc.getSwap(id);
  }
}
