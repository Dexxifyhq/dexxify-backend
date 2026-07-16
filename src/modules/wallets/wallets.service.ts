import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Wallet,
  LedgerEntry,
  LedgerEntryStatus,
  TxType,
  WithdrawalWallet,
  Payout,
  PayoutStatus,
} from '../../database/entities';
import {
  CreateWalletDto,
  InitiateFiatWithdrawalDto,
  InitiateStableCoinWithdrawalDto,
  WalletQueryDto,
} from './dto';
import { parsePagination, buildPaginationMeta } from '../../common/utils';

import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { PlatformContextService } from '../platform/platform-context.service';
import {
  WithdrawalWalletNetwork,
  WithdrawalWalletToken,
} from '../../database/entities/withdrawal-wallet.entity';

// Maps WithdrawalNetwork values → CC chain identifiers
const WITHDRAWAL_CHAIN_MAP: Record<string, string> = {
  ERC20: 'ethereum',
  TRC20: 'tron',
  SOL: 'solana',
  BSC: 'bsc',
  TON: 'ton',
};

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly STABLECOIN_FEE_PERCENT = 1.0;
  private readonly FIAT_WITHDRAWAL_FEE_PERCENT = 1.5;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WithdrawalWallet)
    private readonly withdrawalWalletRepo: Repository<WithdrawalWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    private readonly cc: CoincircuitService,
    private readonly platformCtx: PlatformContextService,
  ) {}

  async create(developerId: string, dto: CreateWalletDto) {
    const existing = await this.walletRepo.findOne({
      where: { label: dto.label },
    });

    if (existing) {
      throw new BadRequestException(
        `Wallet with label "${dto.label}" already exists for a developer.`,
      );
    }

    try {
      const account = await this.cc.createDepositAccount();
      const ccAccount = account.data;

      const wallet = Object.assign(this.walletRepo.create(), {
        id: ccAccount.id,
        developer_id: developerId,
        // asset_id: dto.asset_id,
        deposit_addresses: ccAccount.staticDepositAddresses || [],
        ngn_virtual_accounts: ccAccount.ngnVirtualAccounts || [],
        label: dto.label,
        bank_id: dto.bank_id || null,
        account_number: dto.account_number || null,
      } as Wallet);

      return this.walletRepo.save(wallet);
    } catch (err) {
      this.logger.error(`Wallet creation failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to create wallet with crypto provider.',
      );
    }
  }

  async findOne(developerId: string, walletId: string) {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, developer_id: developerId },
    });

    if (!wallet) throw new NotFoundException('Wallet not found.');
    return wallet;
  }

  async findAll(developerId: string, query: WalletQueryDto) {
    const { offset, limit, page } = parsePagination(query);

    const qb = this.walletRepo
      .createQueryBuilder('w')
      .where('w.developer_id = :developerId', { developerId })
      .orderBy('w.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.wallet_id) {
      qb.andWhere('w.id = :uid', { uid: query.wallet_id });
    }
    if (query.asset_id) {
      qb.andWhere('w.asset_id = :assetId', { assetId: query.asset_id });
    }

    const [wallets, total] = await qb.getManyAndCount();

    return {
      data: wallets,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getDepositAddress(developerId: string, walletId: string) {
    const wallet = await this.findOne(developerId, walletId);

    if (wallet.deposit_addresses?.length === 0) {
      try {
        const account = await this.cc.getDepositAccount(wallet.id);
        const addresses = account.data?.staticDepositAddresses || [];
        const ngnAccounts = account.data?.ngnVirtualAccounts || [];
        if (addresses.length !== 0) {
          await this.walletRepo.update(walletId, {
            deposit_addresses: addresses,
            ngn_virtual_accounts: ngnAccounts,
          });
        }
        return {
          deposit_addresses: addresses,
          ngn_virtual_accounts: ngnAccounts,
        };
      } catch {
        throw new BadRequestException('Failed to retrieve deposit addresses.');
      }
    }

    return {
      deposit_addresses: wallet.deposit_addresses,
      ngn_virtual_accounts: wallet.ngn_virtual_accounts,
    };
  }

  async getWalletDetails(walletId: string): Promise<any> {
    try {
      const account = await this.cc.getDepositAccount(walletId);
      return account.data;
    } catch (err) {
      this.logger.error(`Wallet retrieval failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to retrieve wallet with crypto provider.',
      );
    }
  }

  async getAllWalletDetails() {
    try {
      const accounts = await this.cc.listDepositAccounts();
      return accounts.data;
    } catch (err) {
      this.logger.error(`Wallet retrieval failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to retrieve wallets with crypto provider.',
      );
    }
  }

  async getAllTransactions(developerId: string, query: any) {
    const { offset, limit, page } = parsePagination(query);

    const [entries, total] = await this.ledgerRepo.findAndCount({
      where: { developer_id: developerId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      data: entries,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getTransactionsById(
    developerId: string,
    transactionId: string,
    query: any,
  ) {
    // const wallet = await this.findOne(developerId, walletId);

    const { offset, limit, page } = parsePagination(query);

    const [entries, total] = await this.ledgerRepo.findAndCount({
      where: { developer_id: developerId, id: transactionId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      data: entries,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  // Withdrawal Address Management

  async addWithdrawalAddress(
    data: {
      address: string;
      network: string;
      token: string;
      label: string;
      isDefault: boolean;
    },
    developerId: string,
  ) {
    const ccChain =
      WITHDRAWAL_CHAIN_MAP[data.network] || data.network.toLowerCase();

    const result = await this.cc.createRecipient({
      type: 'crypto_address',
      label: data.label,
      isDefault: data.isDefault,
      details: { chain: ccChain, address: data.address },
    });

    const recipient = result.data;
    const details = recipient.details;
    // console.log('recipient', recipient);

    const saved = await this.withdrawalWalletRepo.save({
      id: recipient.id,
      developer_id: developerId,
      address: data.address,
      network: data.network as WithdrawalWalletNetwork,
      token: data.token as WithdrawalWalletToken,
      label: data.label,
      primary: details.isDefault,
    });

    this.logger.log(`Withdrawal address saved: ${saved.id}`);
    return { success: true, data: saved };
  }

  async getSavedWithdrawalAddresses(developerId: string) {
    return this.withdrawalWalletRepo.find({
      where: { developer_id: developerId },
    });
  }

  async getWithdrawalAddresses() {
    return this.withdrawalWalletRepo.find();
  }

  async removeWithdrawalAddress(addressId: string) {
    const saved = await this.withdrawalWalletRepo.findOne({
      where: { id: addressId },
    });

    if (saved) {
      await this.cc.deleteRecipient(saved.id);
      await this.withdrawalWalletRepo.delete({ id: addressId });
    }

    return { success: true };
  }

  // Withdrawals

  async initiateStableCoinWithdrawal(
    dto: InitiateStableCoinWithdrawalDto,
    developerId: string,
  ) {
    const saved = await this.withdrawalWalletRepo.findOne({
      where: { address: dto.address },
    });

    if (!saved) {
      throw new BadRequestException(
        'Withdrawal address not found. Please add the address first.',
      );
    }

    const feeAmount = dto.amount * (this.STABLECOIN_FEE_PERCENT / 100);
    const netAmount = dto.amount - feeAmount;
    const isStablecoin = ['USDT', 'USDC'].includes(dto.token.toUpperCase());

    const result = await this.cc.initiatePayout({
      recipientId: saved.id,
      amount: netAmount.toString(),
      currency: dto.token,
      narration: dto.externalId,
    });

    const payoutId: string = result.data?.id;

    // Withdrawal debit — pending until payout.success fires
    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.WITHDRAWAL,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        debit_ngn: isStablecoin ? 0 : netAmount,
        debit_usd: isStablecoin ? netAmount : 0,
        credit_ngn: 0,
        asset: dto.token,
        status: LedgerEntryStatus.PENDING,
        description: `${dto.token} withdrawal to ${dto.address}`,
      }),
    );

    // Fee debit from developer + matching credit to platform (double-entry)
    const platformId = this.platformCtx.getDeveloperId();
    await this.ledgerRepo.save([
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        debit_ngn: isStablecoin ? 0 : feeAmount,
        debit_usd: isStablecoin ? feeAmount : 0,
        credit_ngn: 0,
        asset: dto.token,
        status: LedgerEntryStatus.COMPLETED,
        description: `${this.STABLECOIN_FEE_PERCENT}% withdrawal fee`,
      }),
      this.ledgerRepo.create({
        developer_id: platformId,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        credit_ngn: isStablecoin ? 0 : feeAmount,
        credit_usd: isStablecoin ? feeAmount : 0,
        debit_ngn: 0,
        asset: dto.token,
        status: LedgerEntryStatus.COMPLETED,
        description: `Fee income: ${this.STABLECOIN_FEE_PERCENT}% stablecoin withdrawal`,
      }),
    ]);

    this.logger.log(`Stablecoin withdrawal initiated: ${payoutId}`);
    return { ...result, fee: feeAmount, net_amount: netAmount };
  }

  async initiateFiatWithdrawal(
    dto: InitiateFiatWithdrawalDto,
    developerId: string,
  ) {
    const feeAmount = dto.amount * (this.FIAT_WITHDRAWAL_FEE_PERCENT / 100);
    const netAmount = dto.amount - feeAmount;

    const calculatedBalance = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('SUM(ledger.credit_ngn) - SUM(ledger.debit_ngn)', 'balance')
      .where('ledger.status IN (:...statuses)', {
        statuses: [
          LedgerEntryStatus.COMPLETED,
          LedgerEntryStatus.REJECTED,
          LedgerEntryStatus.REVERSED,
        ],
      })
      .andWhere('ledger.developer_id = :developerId', { developerId })
      .getRawOne();

    if ((calculatedBalance.balance ?? 0) < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // dto.bank_id is the CC recipient ID for the bank
    const result = await this.cc.initiatePayout({
      recipientId: dto.bank_id,
      amount: netAmount.toString(),
      currency: 'NGN',
      narration: dto.narration,
    });

    const payoutId: string = result.data.id;

    // Save Payout record — payout.success webhook writes the withdrawal debit
    await this.payoutRepo.save(
      this.payoutRepo.create({
        developer_id: developerId,
        amount: dto.amount,
        fee: feeAmount,
        narration: dto.narration,
        status: PayoutStatus.PENDING,
        provider_payout_id: payoutId,
        metadata: { recipientId: dto.bank_id },
      }),
    );

    // Fee debit from developer + matching credit to platform (double-entry)
    const platformId = this.platformCtx.getDeveloperId();
    await this.ledgerRepo.save([
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        debit_ngn: feeAmount,
        credit_ngn: 0,
        asset: 'NGN',
        status: LedgerEntryStatus.COMPLETED,
        description: `${this.FIAT_WITHDRAWAL_FEE_PERCENT}% withdrawal fee`,
      }),
      this.ledgerRepo.create({
        developer_id: platformId,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        credit_ngn: feeAmount,
        debit_ngn: 0,
        asset: 'NGN',
        status: LedgerEntryStatus.COMPLETED,
        description: `Fee income: ${this.FIAT_WITHDRAWAL_FEE_PERCENT}% fiat withdrawal`,
      }),
    ]);

    this.logger.log(`Fiat withdrawal initiated: ${payoutId}`);
    return { ...result, fee: feeAmount, net_amount: netAmount };
  }

  async listPayouts(options: { page: string; size: string }) {
    return this.cc.listPayouts({ page: options.page, limit: options.size });
  }
}
