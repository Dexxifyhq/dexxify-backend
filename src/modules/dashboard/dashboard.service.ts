import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  ApiKey,
  LedgerEntry,
  LedgerEntryStatus,
  TxType,
  Payout,
  PayoutStatus,
  Customer,
  PaymentSession,
  PaymentSessionStatus,
  Invoice,
  InvoiceStatus,
  DepositAccount,
} from '../../database/entities';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { generateApiKey } from '../../common/utils';

interface BalancesRawRow {
  balance_ngn: string | null;
  balance_usdt: string | null;
  balance_usdc: string | null;
  received_ngn: string | null;
  received_usdt: string | null;
  received_usdc: string | null;
}

interface SessionStatusCountRow {
  status: PaymentSessionStatus;
  count: string;
  volume: string;
}

interface InvoiceStatusCountRow {
  status: InvoiceStatus;
  count: string;
  volume: string;
}

interface PendingPayoutsRow {
  count: string | null;
  total_amount: string | null;
}

interface RevenueChartRow {
  date: string;
  ngn: string;
  usdt: string;
  usdc: string;
  tx_count: string;
}

interface AssetDistributionRow {
  asset: string;
  network: string | null;
  total_sessions: string;
  completed: string;
  pending: string;
  total_volume: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(DepositAccount)
    private readonly depositAccountRepo: Repository<DepositAccount>,
  ) {}

  // ── API Key Management ──────────────────────────────────

  async createApiKey(userId: string, businessId: string, dto: CreateApiKeyDto) {
    const count = await this.apiKeyRepo.count({
      where: {
        business_id: businessId,
        mode: dto.mode,
        is_active: true,
      },
    });

    if (count >= 5) {
      throw new BadRequestException(
        `Maximum 5 active ${dto.mode} API keys allowed.`,
      );
    }

    const { key, prefix, hash } = generateApiKey(dto.mode);

    const saved = await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        user_id: userId,
        business_id: businessId,
        key_hash: hash,
        key_prefix: prefix,
        label: dto.label || `${dto.mode} key`,
        mode: dto.mode,
      }),
    );

    const { key_hash, ...safeResult } = saved;
    void key_hash;
    return { ...safeResult, key };
  }

  async listApiKeys(userId: string) {
    return this.apiKeyRepo.find({
      where: { user_id: userId },
      select: [
        'id',
        'key_prefix',
        'label',
        'mode',
        'is_active',
        'last_used_at',
        'ip_whitelist',
        'created_at',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    const result = await this.apiKeyRepo.update(
      { id: keyId, user_id: userId },
      { is_active: false },
    );
    if (result.affected === 0)
      throw new NotFoundException('API key not found.');
    return { revoked: true, id: keyId };
  }

  async updateApiKey(userId: string, keyId: string, dto: UpdateApiKeyDto) {
    const updates: Partial<ApiKey> = {};
    if (dto.label !== undefined) updates.label = dto.label;
    if (dto.ip_whitelist !== undefined) updates.ip_whitelist = dto.ip_whitelist;

    const result = await this.apiKeyRepo.update(
      { id: keyId, user_id: userId },
      updates,
    );
    if (result.affected === 0)
      throw new NotFoundException('API key not found.');

    return this.apiKeyRepo.findOne({
      where: { id: keyId },
      select: [
        'id',
        'key_prefix',
        'label',
        'mode',
        'is_active',
        'ip_whitelist',
        'last_used_at',
      ],
    });
  }

  // ── Dashboard Stats ─────────────────────────────────────

  async getOverview(businessId: string, mode: 'live' | 'test') {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [
      balances,
      sessionRows,
      invoiceRows,
      totalCustomers,
      newCustomers,
      pendingPayouts,
    ] = await Promise.all([
      // Current balances + lifetime received per currency
      this.ledgerRepo
        .createQueryBuilder('l')
        .select('SUM(l.credit_ngn) - SUM(l.debit_ngn)', 'balance_ngn')
        .addSelect('SUM(l.credit_usdt) - SUM(l.debit_usdt)', 'balance_usdt')
        .addSelect('SUM(l.credit_usdc) - SUM(l.debit_usdc)', 'balance_usdc')
        .addSelect('SUM(l.credit_ngn)', 'received_ngn')
        .addSelect('SUM(l.credit_usdt)', 'received_usdt')
        .addSelect('SUM(l.credit_usdc)', 'received_usdc')
        .where('l.business_id = :businessId', { businessId })
        .andWhere('l.mode = :mode', { mode })
        .andWhere('l.status = :status', { status: LedgerEntryStatus.COMPLETED })
        .getRawOne<BalancesRawRow>(),

      // Payment sessions grouped by status
      this.sessionRepo
        .createQueryBuilder('s')
        .select('s.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(s.amount), 0)', 'volume')
        .where('s.business_id = :businessId', { businessId })
        .andWhere('s.mode = :mode', { mode })
        .groupBy('s.status')
        .getRawMany<SessionStatusCountRow>(),

      // Invoices grouped by status
      this.invoiceRepo
        .createQueryBuilder('i')
        .select('i.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(i.total), 0)', 'volume')
        .where('i.business_id = :businessId', { businessId })
        .andWhere('i.mode = :mode', { mode })
        .groupBy('i.status')
        .getRawMany<InvoiceStatusCountRow>(),

      // Total customers
      this.customerRepo.count({ where: { business_id: businessId, mode } }),

      // New customers this calendar month
      this.customerRepo.count({
        where: {
          business_id: businessId,
          mode,
          created_at: MoreThanOrEqual(startOfMonth),
        },
      }),

      // Pending / processing payouts
      this.payoutRepo
        .createQueryBuilder('p')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(p.amount), 0)', 'total_amount')
        .where('p.business_id = :businessId', { businessId })
        .andWhere('p.mode = :mode', { mode })
        .andWhere('p.status IN (:...statuses)', {
          statuses: [PayoutStatus.PENDING, PayoutStatus.PROCESSING],
        })
        .getRawOne<PendingPayoutsRow>(),
    ]);

    // Shape session breakdown
    const sessions: Record<string, { count: number; volume: number }> = {};
    let totalSessions = 0;
    for (const row of sessionRows) {
      sessions[row.status] = {
        count: parseInt(row.count, 10),
        volume: Number(row.volume),
      };
      totalSessions += parseInt(row.count, 10);
    }

    // Shape invoice breakdown
    const invoices: Record<string, { count: number; volume?: number }> = {};
    let totalInvoices = 0;
    for (const row of invoiceRows) {
      invoices[row.status] = {
        count: parseInt(row.count, 10),
        ...(row.status === InvoiceStatus.PAID
          ? { volume: Number(row.volume) }
          : {}),
      };
      totalInvoices += parseInt(row.count, 10);
    }

    return {
      balances: {
        ngn: Number(balances?.balance_ngn ?? 0),
        usdt: Number(balances?.balance_usdt ?? 0),
        usdc: Number(balances?.balance_usdc ?? 0),
      },
      total_received: {
        ngn: Number(balances?.received_ngn ?? 0),
        usdt: Number(balances?.received_usdt ?? 0),
        usdc: Number(balances?.received_usdc ?? 0),
      },
      payment_sessions: {
        total: totalSessions,
        ...sessions,
      },
      invoices: {
        total: totalInvoices,
        ...invoices,
      },
      customers: {
        total: totalCustomers,
        new_this_month: newCustomers,
      },
      pending_payouts: {
        count: parseInt(pendingPayouts?.count ?? '0', 10),
        total_amount: Number(pendingPayouts?.total_amount ?? 0),
      },
    };
  }

  async getRevenueChart(businessId: string, mode: 'live' | 'test', days = 30) {
    const clampedDays = Math.min(365, Math.max(1, days));
    const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000);

    const rows = await this.ledgerRepo
      .createQueryBuilder('l')
      .select("DATE(l.created_at AT TIME ZONE 'UTC')", 'date')
      .addSelect('COALESCE(SUM(l.credit_ngn), 0)', 'ngn')
      .addSelect('COALESCE(SUM(l.credit_usdt), 0)', 'usdt')
      .addSelect('COALESCE(SUM(l.credit_usdc), 0)', 'usdc')
      .addSelect('COUNT(*)', 'tx_count')
      .where('l.business_id = :businessId', { businessId })
      .andWhere('l.mode = :mode', { mode })
      .andWhere('l.tx_type IN (:...types)', {
        types: [TxType.DEPOSIT, TxType.ONRAMP],
      })
      .andWhere('l.status = :status', { status: LedgerEntryStatus.COMPLETED })
      .andWhere('l.created_at >= :since', { since })
      .groupBy("DATE(l.created_at AT TIME ZONE 'UTC')")
      .orderBy('date', 'ASC')
      .getRawMany<RevenueChartRow>();

    return {
      data: rows.map((r) => ({
        date: r.date,
        ngn: Number(r.ngn),
        usdt: Number(r.usdt),
        usdc: Number(r.usdc),
        tx_count: parseInt(r.tx_count, 10),
      })),
    };
  }

  async getAssetDistribution(businessId: string, mode: 'live' | 'test') {
    const rows = await this.sessionRepo
      .createQueryBuilder('s')
      .select('s.crypto_asset', 'asset')
      .addSelect('s.network', 'network')
      .addSelect('COUNT(*)', 'total_sessions')
      .addSelect(
        `SUM(CASE WHEN s.status = '${PaymentSessionStatus.COMPLETED}' THEN 1 ELSE 0 END)`,
        'completed',
      )
      .addSelect(
        `SUM(CASE WHEN s.status = '${PaymentSessionStatus.PENDING}' THEN 1 ELSE 0 END)`,
        'pending',
      )
      .addSelect('COALESCE(SUM(s.amount), 0)', 'total_volume')
      .where('s.business_id = :businessId', { businessId })
      .andWhere('s.mode = :mode', { mode })
      .andWhere('s.crypto_asset IS NOT NULL')
      .groupBy('s.crypto_asset')
      .addGroupBy('s.network')
      .orderBy('total_sessions', 'DESC')
      .getRawMany<AssetDistributionRow>();

    return {
      data: rows.map((r) => ({
        asset: r.asset,
        network: r.network,
        total_sessions: parseInt(r.total_sessions, 10),
        completed: parseInt(r.completed, 10),
        pending: parseInt(r.pending, 10),
        total_volume: Number(r.total_volume),
      })),
    };
  }

  async getRecentActivity(
    businessId: string,
    mode: 'live' | 'test',
    limit = 10,
  ) {
    const take = Math.min(50, Math.max(1, limit));

    const entries = await this.ledgerRepo.find({
      where: { business_id: businessId, mode },
      order: { created_at: 'DESC' },
      take,
      select: [
        'id',
        'tx_type',
        'asset',
        'currency',
        'credit_ngn',
        'debit_ngn',
        'credit_usdt',
        'debit_usdt',
        'credit_usdc',
        'debit_usdc',
        'status',
        'description',
        'created_at',
      ],
    });

    return {
      data: entries.map((e) => {
        const creditNgn = Number(e.credit_ngn);
        const creditUsdt = Number(e.credit_usdt);
        const creditUsdc = Number(e.credit_usdc);
        const debitNgn = Number(e.debit_ngn);
        const debitUsdt = Number(e.debit_usdt);
        const debitUsdc = Number(e.debit_usdc);

        const isCredit = creditNgn > 0 || creditUsdt > 0 || creditUsdc > 0;
        const amount = isCredit
          ? creditNgn || creditUsdt || creditUsdc
          : debitNgn || debitUsdt || debitUsdc;
        const displayCurrency =
          creditNgn > 0 || debitNgn > 0
            ? 'NGN'
            : creditUsdt > 0 || debitUsdt > 0
              ? 'USDT'
              : 'USDC';

        return {
          id: e.id,
          type: e.tx_type,
          direction: isCredit ? 'credit' : 'debit',
          amount,
          currency: displayCurrency,
          asset: e.asset,
          status: e.status,
          description: e.description,
          created_at: e.created_at,
        };
      }),
    };
  }
}
