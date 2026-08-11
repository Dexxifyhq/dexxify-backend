import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { SwapRecord, SwapRecordStatus } from '../../database/entities';
import { EstimateSwapDto, CreateSwapQuotationDto, SwapQueryDto } from './dto';
import { parsePagination, buildPaginationMeta } from '../../common/utils';

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

  async list(businessId: string, mode: 'live' | 'test', query: SwapQueryDto) {
    const { offset, limit, page } = parsePagination({
      page: query.page,
      limit: query.size,
    });

    const qb = this.swapRecordRepo
      .createQueryBuilder('sr')
      .where('sr.business_id = :businessId', { businessId })
      .andWhere('sr.mode = :mode', { mode })
      .orderBy('sr.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.fromCurrency)
      qb.andWhere('sr.from_currency = :fromCurrency', {
        fromCurrency: query.fromCurrency,
      });
    if (query.toCurrency)
      qb.andWhere('sr.to_currency = :toCurrency', {
        toCurrency: query.toCurrency,
      });
    if (query.startDate)
      qb.andWhere('sr.created_at >= :startDate', {
        startDate: query.startDate,
      });
    if (query.endDate)
      qb.andWhere('sr.created_at <= :endDate', { endDate: query.endDate });

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(businessId: string, mode: 'live' | 'test', id: string) {
    const record = await this.swapRecordRepo.findOne({
      where: { cc_swap_id: id, business_id: businessId, mode },
    });
    if (!record) throw new NotFoundException('Swap not found.');
    return record;
  }
}
