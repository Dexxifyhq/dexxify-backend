import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

interface PlatformBalanceRaw {
  total_revenue_ngn: string;
  total_withdrawn_ngn: string;
  available_ngn: string;
  total_revenue_usdt: string;
  total_withdrawn_usdt: string;
  available_usdt: string;
  total_revenue_usdc: string;
  total_withdrawn_usdc: string;
  available_usdc: string;
}

interface CoincircuitPayoutData {
  id: string;
}

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
        'COALESCE(SUM(le.credit_usdt), 0) AS total_revenue_usdt',
        'COALESCE(SUM(le.debit_usdt), 0)  AS total_withdrawn_usdt',
        'COALESCE(SUM(le.credit_usdt) - SUM(le.debit_usdt), 0) AS available_usdt',
        'COALESCE(SUM(le.credit_usdc), 0) AS total_revenue_usdc',
        'COALESCE(SUM(le.debit_usdc), 0)  AS total_withdrawn_usdc',
        'COALESCE(SUM(le.credit_usdc) - SUM(le.debit_usdc), 0) AS available_usdc',
      ])
      .where('le.business_id = :platformId', { platformId })
      .andWhere('le.status IN (:...statuses)', {
        statuses: [
          LedgerEntryStatus.COMPLETED,
          LedgerEntryStatus.REVERSED,
          LedgerEntryStatus.REJECTED,
        ],
      })
      .getRawOne<PlatformBalanceRaw>();

    return {
      ngn: {
        total_revenue: Number(result?.total_revenue_ngn),
        total_withdrawn: Number(result?.total_withdrawn_ngn),
        available: Number(result?.available_ngn),
      },
      usdt: {
        total_revenue: Number(result?.total_revenue_usdt),
        total_withdrawn: Number(result?.total_withdrawn_usdt),
        available: Number(result?.available_usdt),
      },
      usdc: {
        total_revenue: Number(result?.total_revenue_usdc),
        total_withdrawn: Number(result?.total_withdrawn_usdc),
        available: Number(result?.available_usdc),
      },
      as_of: new Date().toISOString(),
    };
  }

  async withdrawFees(dto: WithdrawFeesDto) {
    const platformId = this.platform.getBusinessId();

    // Guard against withdrawing more than what's available
    const balance = await this.getPlatformBalance();
    const available =
      dto.currency === 'NGN'
        ? balance.ngn.available
        : dto.currency === 'USDT'
          ? balance.usdt.available
          : balance.usdc.available;

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

    const payoutId: string = (result.data as CoincircuitPayoutData).id;

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
