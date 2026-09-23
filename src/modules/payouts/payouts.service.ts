import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, LedgerEntry } from '../../database/entities';
import { parsePagination, buildPaginationMeta } from '../../common/utils';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly PAYOUT_FEE = 150;

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly cc: CoincircuitService,
  ) {}

  async findOne(businessId: string, mode: 'live' | 'test', payoutId: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId, business_id: businessId, mode },
    });
    if (!payout) throw new NotFoundException('Payout not found.');
    return payout;
  }

  async findAll(
    businessId: string,
    mode: 'live' | 'test',
    query: { page?: number; limit?: number },
  ) {
    const { offset, limit, page } = parsePagination(query);
    const [data, total] = await this.payoutRepo.findAndCount({
      where: { business_id: businessId, mode },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}
