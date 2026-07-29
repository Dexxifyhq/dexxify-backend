import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LedgerEntry,
  LedgerEntryStatus,
  Payout,
  PayoutStatus,
} from '../../database/entities';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { PlatformContextService } from '../platform/platform-context.service';
import { WithdrawFeesDto } from './dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    private readonly platform: PlatformContextService,
    private readonly cc: CoincircuitService,
  ) {}

  async getPlatformBalance() {
    const platformId = this.platform.getBusinessId();

    const result = await this.ledgerRepo
      .createQueryBuilder('le')
      .select([
        'COALESCE(SUM(le.credit_ngn), 0) AS total_revenue_ngn',
        'COALESCE(SUM(le.debit_ngn), 0)  AS total_withdrawn_ngn',
        'COALESCE(SUM(le.credit_ngn) - SUM(le.debit_ngn), 0) AS available_ngn',
        'COALESCE(SUM(le.credit_usd), 0) AS total_revenue_usd',
        'COALESCE(SUM(le.debit_usd), 0)  AS total_withdrawn_usd',
        'COALESCE(SUM(le.credit_usd) - SUM(le.debit_usd), 0) AS available_usd',
      ])
      .where('le.business_id = :platformId', { platformId })
      .andWhere('le.status IN (:...statuses)', {
        statuses: [
          LedgerEntryStatus.COMPLETED,
          LedgerEntryStatus.REVERSED,
          LedgerEntryStatus.REJECTED,
        ],
      })
      .getRawOne();

    return {
      ngn: {
        total_revenue: Number(result.total_revenue_ngn),
        total_withdrawn: Number(result.total_withdrawn_ngn),
        available: Number(result.available_ngn),
      },
      usd: {
        total_revenue: Number(result.total_revenue_usd),
        total_withdrawn: Number(result.total_withdrawn_usd),
        available: Number(result.available_usd),
      },
      as_of: new Date().toISOString(),
    };
  }

  async withdrawFees(dto: WithdrawFeesDto) {
    const platformId = this.platform.getBusinessId();

    // Guard against withdrawing more than what's available
    const balance = await this.getPlatformBalance();
    const available =
      dto.currency === 'NGN' ? balance.ngn.available : balance.usd.available;

    if (dto.amount > available) {
      throw new BadRequestException(
        `Insufficient platform balance. Available: ${dto.currency} ${available.toFixed(2)}`,
      );
    }

    const result = await this.cc.initiatePayout('live', {
      recipientId: dto.recipient_id,
      amount: dto.amount.toString(),
      currency: dto.currency,
      narration: dto.narration || 'Platform fee withdrawal',
    });

    const payoutId: string = result.data.id;

    // Save under the platform business_id.
    // payout.success webhook writes the debit ledger entry automatically.
    await this.payoutRepo.save(
      this.payoutRepo.create({
        business_id: platformId,
        amount: dto.amount,
        fee: 0,
        narration: dto.narration || 'Platform fee withdrawal',
        status: PayoutStatus.PENDING,
        provider_payout_id: payoutId,
        metadata: { type: 'platform_withdrawal', currency: dto.currency },
      }),
    );

    this.logger.log(
      `Platform withdrawal initiated: ${payoutId} — ${dto.currency} ${dto.amount}`,
    );

    return {
      payout_id: payoutId,
      amount: dto.amount,
      currency: dto.currency,
      balance_after: available - dto.amount,
    };
  }

  async getPlatformLedger(page = 1, limit = 20) {
    const platformId = this.platform.getBusinessId();
    const offset = (page - 1) * limit;

    const [entries, total] = await this.ledgerRepo.findAndCount({
      where: { business_id: platformId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      data: entries,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}
