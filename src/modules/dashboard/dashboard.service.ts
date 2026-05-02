import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  ApiKey,
  Wallet,
  Payout,
  PayoutStatus,
  OfframpTransaction,
  TxStatus,
  KycVerification,
  LedgerEntry,
} from '../../database/entities';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { generateApiKey } from '../../common/utils';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(OfframpTransaction)
    private readonly offrampRepo: Repository<OfframpTransaction>,
    @InjectRepository(KycVerification)
    private readonly kycRepo: Repository<KycVerification>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
  ) {}

  // ── API Key Management ──────────────────────────────────

  async createApiKey(developerId: string, dto: CreateApiKeyDto) {
    const count = await this.apiKeyRepo.count({
      where: {
        developer_id: developerId,
        environment: dto.environment,
        is_active: true,
      },
    });

    if (count >= 5) {
      throw new BadRequestException(
        `Maximum 5 active ${dto.environment} API keys allowed.`,
      );
    }

    const { key, prefix, hash } = generateApiKey(dto.environment);

    const apiKeyEntity = this.apiKeyRepo.create({
      developer_id: developerId,
      key_hash: hash,
      key_prefix: prefix,
      label: dto.label || `${dto.environment} key`,
      environment: dto.environment,
    });

    const saved = await this.apiKeyRepo.save(apiKeyEntity);
    const { key_hash, ...safeResult } = saved;

    return { ...safeResult, key }; // Full key only shown once
  }

  async listApiKeys(developerId: string) {
    return this.apiKeyRepo.find({
      where: { developer_id: developerId },
      select: [
        'id',
        'key_prefix',
        'label',
        'environment',
        'is_active',
        'last_used_at',
        'ip_whitelist',
        'created_at',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async revokeApiKey(developerId: string, keyId: string) {
    const result = await this.apiKeyRepo.update(
      { id: keyId, developer_id: developerId },
      { is_active: false },
    );

    if (result.affected === 0)
      throw new NotFoundException('API key not found.');
    return { revoked: true, id: keyId };
  }

  async updateApiKey(developerId: string, keyId: string, dto: UpdateApiKeyDto) {
    const updates: Partial<ApiKey> = {};
    if (dto.label !== undefined) updates.label = dto.label;
    if (dto.ip_whitelist !== undefined) updates.ip_whitelist = dto.ip_whitelist;

    const result = await this.apiKeyRepo.update(
      { id: keyId, developer_id: developerId },
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
        'environment',
        'is_active',
        'ip_whitelist',
        'last_used_at',
      ],
    });
  }

  // ── Usage & Stats ───────────────────────────────────────

  async getOverview(developerId: string) {
    const [walletCount, payouts, offramps, kycCount] = await Promise.all([
      this.walletRepo.count({ where: { developer_id: developerId } }),
      this.payoutRepo.find({
        where: { developer_id: developerId },
        select: ['amount', 'status'],
      }),
      this.offrampRepo.find({
        where: { developer_id: developerId },
        select: ['ngn_amount', 'status'],
      }),
      this.kycRepo.count({ where: { developer_id: developerId } }),
    ]);

    const totalPayoutVolume = payouts
      .filter((p) => p.status === PayoutStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalOfframpVolume = offramps
      .filter((o) => o.status === TxStatus.COMPLETED)
      .reduce((sum, o) => sum + Number(o.ngn_amount), 0);

    return {
      wallets: { total: walletCount },
      payouts: { total: payouts.length, volume_ngn: totalPayoutVolume },
      offramps: { total: offramps.length, volume_ngn: totalOfframpVolume },
      kyc_verifications: { total: kycCount },
      total_volume_ngn: totalPayoutVolume + totalOfframpVolume,
    };
  }

  async getUsageStats(developerId: string, query: { days?: number }) {
    const days = Math.min(90, Math.max(1, Number(query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const entries = await this.ledgerRepo.find({
      where: {
        developer_id: developerId,
        created_at: MoreThanOrEqual(since),
      },
      select: ['tx_type', 'asset', 'debit', 'credit', 'created_at'],
      order: { created_at: 'ASC' },
    });

    const dailyStats: Record<
      string,
      { transactions: number; volume_debit: number; volume_credit: number }
    > = {};

    for (const entry of entries) {
      const day = entry.created_at.toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = {
          transactions: 0,
          volume_debit: 0,
          volume_credit: 0,
        };
      }
      dailyStats[day].transactions++;
      dailyStats[day].volume_debit += Number(entry.debit);
      dailyStats[day].volume_credit += Number(entry.credit);
    }

    return {
      period_days: days,
      total_transactions: entries.length,
      daily: dailyStats,
    };
  }
}
