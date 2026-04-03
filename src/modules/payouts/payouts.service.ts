import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payout,
  PayoutStatus,
  LedgerEntry,
  TxType,
} from '../../database/entities';
import { CreatePayoutDto, BatchPayoutDto, ResolveAccountDto } from './dto';
import { parsePagination, buildPaginationMeta } from '../../common/utils';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly PAYOUT_FEE = 150;
  private readonly breetApiUrl: string;
  private readonly breetApiKey: string;

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly config: ConfigService,
  ) {
    this.breetApiUrl = this.config.get<string>('breet.apiUrl') || '';
    this.breetApiKey = this.config.get<string>('breet.apiKey') || '';
  }

  async create(developerId: string, dto: CreatePayoutDto) {
    // Resolve account name if not provided
    let accountName = dto.account_name;
    if (!accountName) {
      const resolved = await this.resolveBreetAccount(
        dto.account_number,
        dto.bank_code,
      );
      accountName = resolved.account_name;
    }

    // Initiate payout via Breet
    const transfer = await this.initiateBreetTransfer(
      dto.account_number,
      dto.bank_code,
      accountName,
      dto.amount,
      dto.narration,
    );

    const payout = this.payoutRepo.create({
      developer_id: developerId,
      amount: dto.amount,
      fee: this.PAYOUT_FEE,
      bank_code: dto.bank_code,
      account_number: dto.account_number,
      account_name: accountName,
      narration: dto.narration,
      status: PayoutStatus.PROCESSING,
      breet_reference: transfer.reference,
      breet_transfer_id: transfer.transfer_id,
      metadata: dto.metadata || {},
    });

    const saved = await this.payoutRepo.save(payout);

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.PAYOUT,
        reference_type: 'payout',
        reference_id: saved.id,
        debit: dto.amount + this.PAYOUT_FEE,
        credit: 0,
        currency: 'NGN',
        description: `Payout ₦${dto.amount} to ${dto.account_number}`,
      }),
    );

    return saved;
  }

  async createBatch(developerId: string, dto: BatchPayoutDto) {
    const batchId = crypto.randomUUID();
    const results: any[] = [];

    for (const payoutDto of dto.payouts) {
      try {
        const result = await this.create(developerId, payoutDto);
        await this.payoutRepo.update(result.id, { batch_id: batchId });
        results.push({ ...result, batch_id: batchId, success: true });
      } catch (err: any) {
        results.push({
          account_number: payoutDto.account_number,
          amount: payoutDto.amount,
          success: false,
          error: err.message,
        });
      }
    }

    return { batch_id: batchId, total: dto.payouts.length, results };
  }

  async findOne(developerId: string, payoutId: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId, developer_id: developerId },
    });
    if (!payout) throw new NotFoundException('Payout not found.');
    return payout;
  }

  async findAll(developerId: string, query: any) {
    const { offset, limit, page } = parsePagination(query);

    const [data, total] = await this.payoutRepo.findAndCount({
      where: { developer_id: developerId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async resolveAccount(dto: ResolveAccountDto) {
    return this.resolveBreetAccount(dto.account_number, dto.bank_code);
  }

  // ── Breet Payout Integration Stubs ──────────────────────

  private async initiateBreetTransfer(
    accountNumber: string,
    bankCode: string,
    accountName: string,
    amount: number,
    narration?: string,
  ): Promise<{ reference: string; transfer_id: string }> {
    // TODO: Implement actual Breet payout API call
    // POST ${this.breetApiUrl}/payouts or /transfers
    // Headers: { Authorization: `Bearer ${this.breetApiKey}` }
    // Body: { account_number, bank_code, account_name, amount, narration }
    this.logger.warn('Using stub Breet transfer — implement actual API call');
    return {
      reference: `BRT_TRF_${Date.now()}`,
      transfer_id: `BRT_ID_${Date.now()}`,
    };
  }

  private async resolveBreetAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    account_number: string;
    account_name: string;
    bank_code: string;
  }> {
    // TODO: Implement actual Breet account resolution
    // GET ${this.breetApiUrl}/bank/resolve?account_number=...&bank_code=...
    // Headers: { Authorization: `Bearer ${this.breetApiKey}` }
    this.logger.warn('Using stub Breet resolve — implement actual API call');
    return {
      account_number: accountNumber,
      account_name: 'STUB ACCOUNT NAME',
      bank_code: bankCode,
    };
  }
}
