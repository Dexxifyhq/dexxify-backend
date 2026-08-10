import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from '../../database/entities/bank.entity';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { generateUniqueId } from '../../common/utils';

export interface CCRecipientDetails {
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
  bankName?: string;
  currency?: string;
  accountType?: string;
}

export interface CCRecipient {
  id: string;
  label?: string;
  details?: CCRecipientDetails;
  isDefault?: boolean;
  isTrusted?: boolean;
}

@Injectable()
export class MiscService {
  private readonly logger = new Logger(MiscService.name);

  private bankListCache: { data: any[]; fetchedAt: number } | null = null;
  private readonly BANK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly cc: CoincircuitService,
    @InjectRepository(Bank)
    private readonly bankRepo: Repository<Bank>,
  ) {}

  // ── Banks ─────────────────────────────────────────────

  async getBanks(mode: 'live' | 'test') {
    if (
      this.bankListCache &&
      Date.now() - this.bankListCache.fetchedAt < this.BANK_CACHE_TTL_MS
    ) {
      return { banks: this.bankListCache.data, cached: true };
    }

    const result = await this.cc.listBanks(mode);
    const banks = result.data ?? [];
    this.bankListCache = { data: banks, fetchedAt: Date.now() };
    return { banks, cached: false };
  }

  async addBank(
    businessId: string,
    mode: 'live' | 'test',
    bankData: {
      accountNumber: string;
      bankCode: string;
      label?: string;
      isDefault: boolean;
    },
  ) {
    const existing = await this.bankRepo.find({
      where: { business_id: businessId },
    });
    if (existing.some((b) => b.account_number === bankData.accountNumber)) {
      throw new ConflictException('Bank account already added');
    }

    const result = await this.cc.createRecipient(mode, {
      type: 'ngn_bank_account',
      label: bankData.label,
      isDefault: bankData.isDefault,
      details: {
        accountNumber: bankData.accountNumber,
        bankCode: bankData.bankCode,
      },
    });

    const recipient = result.data as CCRecipient;
    const details = recipient.details ?? {};

    const bank = Object.assign(this.bankRepo.create(), {
      id: generateUniqueId(),
      provider_recipient_id: recipient.id,
      label: recipient.label ?? '',
      business_id: businessId,
      mode,
      account_name: details.accountName ?? '',
      account_number: bankData.accountNumber,
      bank_name: details.bankName ?? '',
      bank_code: details.bankCode ?? '',
      currency: details.currency ?? 'NGN',
      primary: recipient.isDefault,
      is_trusted: recipient.isTrusted,
      type: details.accountType,
    } as Bank);

    const saved = await this.bankRepo.save(bank);
    this.logger.log(`Bank account saved: ${saved.id}`);
    return { ...recipient, local_id: saved.id };
  }

  async getSavedBanks(businessId: string) {
    return this.bankRepo.find({ where: { business_id: businessId } });
  }

  async getSavedBanksById(businessId: string, accountNumber: string) {
    return this.bankRepo.findOne({
      where: { business_id: businessId, account_number: accountNumber },
    });
  }

  async deleteBank(bankId: string) {
    const bank = await this.bankRepo.findOne({ where: { id: bankId } });
    if (!bank) throw new NotFoundException('Bank not found');

    await this.cc.deleteRecipient(bank.mode, bank.provider_recipient_id);
    await this.bankRepo.delete({ id: bankId });
    return { message: 'Bank account deleted.' };
  }

  async verifyBankAccount(
    mode: 'live' | 'test',
    bankData: { accountNumber: string; bankCode: string },
  ) {
    return this.cc.validateRecipient(mode, {
      type: 'ngn_bank_account',
      details: {
        accountNumber: bankData.accountNumber,
        bankCode: bankData.bankCode,
      },
    });
  }

  // ── Assets & Rates ────────────────────────────────────

  async getSupportedAssets(mode: 'live' | 'test') {
    return this.cc.getSupportedAssets(mode);
  }

  async getCryptoPrices(
    mode: 'live' | 'test',
    options: { from: string; to: string },
  ) {
    return this.cc.getConversionRate(mode, options.from, options.to);
  }

  async getRateCalculator(
    mode: 'live' | 'test',
    asset: string,
    amount: number,
    currency: string,
  ) {
    return this.cc.estimatePayment(mode, {
      asset,
      chain: '',
      amount: String(amount),
      currency,
    });
  }

  // ── Health ────────────────────────────────────────────

  getHealth() {
    return {
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
