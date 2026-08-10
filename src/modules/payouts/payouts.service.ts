import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, PayoutStatus, LedgerEntry } from '../../database/entities';
import { CreatePayoutDto, BatchPayoutDto, ResolveAccountDto } from './dto';
import { parsePagination, buildPaginationMeta } from '../../common/utils';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';

interface RecipientValidationData {
  details?: { accountName?: string };
}

interface RecipientData {
  id: string;
}

interface PayoutData {
  id: string;
  reference?: string;
}

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

  async create(
    businessId: string,
    mode: 'live' | 'test',
    dto: CreatePayoutDto,
  ) {
    let accountName = dto.account_name;
    if (!accountName) {
      const resolved = (await this.resolveAccount(mode, {
        account_number: dto.account_number,
        bank_code: dto.bank_code,
      })) as { data: RecipientValidationData };
      accountName = resolved.data?.details?.accountName ?? dto.account_number;
    }

    // Ensure recipient exists in CoincircuitMCP
    const recipientResult = (await this.cc.createRecipient(mode, {
      type: 'ngn_bank_account',
      details: {
        accountNumber: dto.account_number,
        bankCode: dto.bank_code,
      },
    })) as { data: RecipientData };
    const recipientId = recipientResult.data.id;

    // Initiate payout via CoincircuitMCP
    const payoutResult = (await this.cc.initiatePayout(mode, {
      recipientId,
      amount: String(dto.amount),
      currency: 'NGN',
      narration: dto.narration,
    })) as { data: PayoutData };

    const ccPayout = payoutResult.data;

    const payout = this.payoutRepo.create({
      business_id: businessId,
      mode,
      amount: dto.amount,
      fee: this.PAYOUT_FEE,
      bank_code: dto.bank_code,
      account_number: dto.account_number,
      account_name: accountName,
      narration: dto.narration,
      status: PayoutStatus.PROCESSING,
      provider_reference: ccPayout.reference ?? ccPayout.id,
      provider_payout_id: ccPayout.id,
      metadata: dto.metadata || {},
    });

    return this.payoutRepo.save(payout);
  }

  async createBatch(
    businessId: string,
    mode: 'live' | 'test',
    dto: BatchPayoutDto,
  ) {
    const batchId = crypto.randomUUID();
    const results: any[] = [];

    for (const payoutDto of dto.payouts) {
      try {
        const result = await this.create(businessId, mode, payoutDto);
        await this.payoutRepo.update(result.id, { batch_id: batchId });
        results.push({ ...result, batch_id: batchId, success: true });
      } catch (err) {
        results.push({
          account_number: payoutDto.account_number,
          amount: payoutDto.amount,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { batch_id: batchId, total: dto.payouts.length, results };
  }

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

  async resolveAccount(mode: 'live' | 'test', dto: ResolveAccountDto) {
    return this.cc.validateRecipient(mode, {
      type: 'ngn_bank_account',
      details: {
        accountNumber: dto.account_number,
        bankCode: dto.bank_code,
      },
    });
  }
}
