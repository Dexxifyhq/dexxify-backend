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

  async getBanks() {
    if (
      this.bankListCache &&
      Date.now() - this.bankListCache.fetchedAt < this.BANK_CACHE_TTL_MS
    ) {
      return { banks: this.bankListCache.data, cached: true };
    }

    const result = await this.cc.listBanks();
    const banks = result.data ?? [];
    this.bankListCache = { data: banks, fetchedAt: Date.now() };
    return { banks, cached: false };
  }

  async addBank(
    developerId: string,
    bankData: {
      accountNumber: string;
      bankCode: string;
      label?: string;
      isDefault: boolean;
    },
  ) {
    const existing = await this.bankRepo.find({
      where: { developer_id: developerId },
    });
    if (existing.some((b) => b.account_number === bankData.accountNumber)) {
      throw new ConflictException('Bank account already added');
    }

    const result = await this.cc.createRecipient({
      type: 'ngn_bank_account',
      label: bankData.label,
      isDefault: bankData.isDefault,
      details: {
        accountNumber: bankData.accountNumber,
        bankCode: bankData.bankCode,
      },
    });

    const recipient = result.data;
    // console.log('recipient', recipient);
    const details = recipient.details ?? {};

    const bank = Object.assign(this.bankRepo.create(), {
      id: generateUniqueId(),
      provider_recipient_id: recipient.id,
      label: recipient.label ?? '',
      developer_id: developerId,
      account_name: details.accountName ?? '',
      account_number: bankData.accountNumber,
      bank_name: details.bankName ?? '',
      bank_code: details.bankCode ?? '',
      currency: details.currency ?? 'NGN',
      primary: recipient.isDefault,
      // primary: existing.length === 0,
      // auto_settlement: false,
      // disabled: false,
      is_trusted: recipient.isTrusted,
      type: details.accountType,
    } as Bank);

    const saved = (await this.bankRepo.save(bank)) as Bank;
    this.logger.log(`Bank account saved: ${saved.id}`);
    return { ...recipient, local_id: saved.id };
  }

  async getSavedBanks(developerId: string) {
    return this.bankRepo.find({ where: { developer_id: developerId } });
  }

  async getSavedBanksById(developerId: string, accountNumber: string) {
    return this.bankRepo.findOne({
      where: { developer_id: developerId, account_number: accountNumber },
    });
  }

  async deleteBank(bankId: string) {
    const bank = await this.bankRepo.findOne({ where: { id: bankId } });
    if (!bank) throw new NotFoundException('Bank not found');

    await this.cc.deleteRecipient(bank.provider_recipient_id);
    await this.bankRepo.delete({ id: bankId });
    return { message: 'Bank account deleted.' };
  }

  async verifyBankAccount(bankData: {
    accountNumber: string;
    bankCode: string;
  }) {
    return this.cc.validateRecipient({
      type: 'ngn_bank_account',
      details: {
        accountNumber: bankData.accountNumber,
        bankCode: bankData.bankCode,
      },
    });
  }

  // ── Assets & Rates ────────────────────────────────────

  async getSupportedAssets() {
    return this.cc.getSupportedAssets();
  }

  // async getSupportedWithdrawalAssets() {
  //   return this.cc.getSupportedAssets();
  // }

  async getCryptoPrices(options: { from: string; to: string }) {
    return this.cc.getConversionRate(options.from, options.to);
  }

  async getRateCalculator(asset: string, amount: number, currency: string) {
    return this.cc.estimatePayment({
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
