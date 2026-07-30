import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DepositAccount,
  LedgerEntry,
  LedgerEntryStatus,
  LedgerCurrency,
  TxType,
  WithdrawalWallet,
  Payout,
  PayoutStatus,
  User,
  Business,
  Customer,
} from '../../database/entities';
import {
  CreateWalletDto,
  InitiateFiatWithdrawalDto,
  InitiateStableCoinWithdrawalDto,
  IssueDepositIdentityDto,
  DepositIdentityType,
  WalletQueryDto,
} from './dto';
import { parsePagination, buildPaginationMeta } from '../../common/utils';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { PlatformContextService } from '../platform/platform-context.service';
import {
  WithdrawalWalletNetwork,
  WithdrawalWalletToken,
} from '../../database/entities/withdrawal-wallet.entity';
import { CustomersService } from '../customers/customers.service';

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
    @InjectRepository(DepositAccount)
    private readonly walletRepo: Repository<DepositAccount>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(WithdrawalWallet)
    private readonly withdrawalWalletRepo: Repository<WithdrawalWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    private readonly cc: CoincircuitService,
    private readonly customer: CustomersService,
    private readonly platformCtx: PlatformContextService,
  ) {}

  async create(
    businessId: string,
    mode: 'live' | 'test',
    dto: CreateWalletDto,
  ) {
    let ccCustomerId: string | null = null;
    let localCustomer: Customer | null = null;

    if (dto.customer_id) {
      localCustomer = await this.customerRepo.findOne({
        where: {
          business_id: businessId,
          cc_customer_id: dto.customer_id,
          mode,
        },
      });
      if (!localCustomer) {
        throw new BadRequestException(
          'No customer found for the provided customer ID.',
        );
      }
      ccCustomerId = dto.customer_id;
    } else {
      // No customer ID — use business owner's profile
      const business = await this.businessRepo.findOne({
        where: { id: businessId },
      });
      if (!business) throw new BadRequestException('Business not found.');

      const owner = await this.userRepo.findOne({
        where: { id: business.owner_user_id },
      });
      if (!owner) throw new BadRequestException('Business owner not found.');

      const existingCustomer = await this.customerRepo.findOne({
        where: { business_id: businessId, email: business.email, mode },
      });

      if (existingCustomer) {
        localCustomer = existingCustomer;
        ccCustomerId = existingCustomer.cc_customer_id;
        // console.log('existingCustomer', existingCustomer);
        if (localCustomer.id) {
          const existingWallet = await this.walletRepo
            .createQueryBuilder('wallet')
            .innerJoin('wallet.customer', 'customer')
            .where('wallet.business_id = :businessId', { businessId })
            .andWhere('customer.cc_customer_id = :ccCustomerId', {
              ccCustomerId: localCustomer.cc_customer_id,
            })
            .andWhere('wallet.mode = :mode', { mode })
            .getOne();
          if (existingWallet) {
            // console.log('existingWallet', existingWallet);
            return this.getDepositAddress(businessId, existingWallet);
          }
        }
      } else {
        localCustomer = await this.customer.create(businessId, mode, {
          email: business.email,
          first_name: owner.first_name,
          last_name: owner.last_name,
          phone: owner.phone ?? undefined,
        });
        ccCustomerId = localCustomer.cc_customer_id;
      }
    }

    if (!ccCustomerId || !localCustomer) {
      throw new BadRequestException(
        'Customer is not synced with payment provider.',
      );
    }

    try {
      const account = await this.cc.createDepositAccount(mode, ccCustomerId);
      const ccAccount = account.data;
      this.logger.log(`Created deposit account: ${ccAccount.id}`);

      const wallet = Object.assign(this.walletRepo.create(), {
        id: ccAccount.id,
        business_id: businessId,
        mode,
        customer_id: localCustomer.id,
        deposit_addresses: ccAccount.staticDepositAddresses || [],
        ngn_virtual_accounts: ccAccount.ngnVirtualAccounts || [],
      });

      return this.walletRepo.save(wallet);
    } catch (err) {
      this.logger.error(`Deposit account creation failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to create deposit account with payment provider.',
      );
    }
  }

  async findOne(businessId: string, mode: 'live' | 'test', walletId: string) {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, business_id: businessId, mode },
    });
    if (!wallet) throw new NotFoundException('Wallet not found.');
    return wallet;
  }

  async findAll(
    businessId: string,
    mode: 'live' | 'test',
    query: WalletQueryDto,
  ) {
    const { offset, limit, page } = parsePagination(query);

    const qb = this.walletRepo
      .createQueryBuilder('w')
      .where('w.business_id = :businessId', { businessId })
      .andWhere('w.mode = :mode', { mode })
      .orderBy('w.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.wallet_id) {
      qb.andWhere('w.id = :uid', { uid: query.wallet_id });
    }

    const [wallets, total] = await qb.getManyAndCount();
    return { data: wallets, meta: buildPaginationMeta(total, page, limit) };
  }

  async getDepositAddress(_businessId: string, wallet: DepositAccount) {
    if (wallet.deposit_addresses?.length === 0) {
      try {
        const account = await this.cc.getDepositAccount(wallet.mode, wallet.id);
        const addresses = account.data?.staticDepositAddresses || [];
        const ngnAccounts = account.data?.ngnVirtualAccounts || [];
        if (addresses.length !== 0) {
          await this.walletRepo.update(wallet.id, {
            deposit_addresses: addresses,
            ngn_virtual_accounts: ngnAccounts,
          });
        }
        return {
          id: wallet.id,
          deposit_addresses: addresses,
          ngn_virtual_accounts: ngnAccounts,
        };
      } catch {
        throw new BadRequestException('Failed to retrieve deposit addresses.');
      }
    }

    return {
      id: wallet.id,
      deposit_addresses: wallet.deposit_addresses,
      ngn_virtual_accounts: wallet.ngn_virtual_accounts,
    };
  }

  async issueIdentity(
    businessId: string,
    mode: 'live' | 'test',
    walletId: string,
    dto: IssueDepositIdentityDto,
  ) {
    await this.findOne(businessId, mode, walletId);

    const result = await this.cc.issueDepositIdentity(mode, walletId, {
      type: dto.type,
      chain: dto.chain ?? undefined,
      bvn: dto.bvn ?? undefined,
      currency:
        dto.type === DepositIdentityType.NGN_VIRTUAL_ACCOUNT
          ? 'NGN'
          : undefined,
    });

    const account = result.data;

    this.walletRepo.update(walletId, {
      deposit_addresses: account.staticDepositAddresses ?? [],
      ngn_virtual_accounts: account.ngnVirtualAccounts ?? [],
    });

    return account;
  }

  async getWalletDetails(walletId: string): Promise<any> {
    try {
      const account = await this.cc.getDepositAccount('live', walletId);
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
      const accounts = await this.cc.listDepositAccounts('live');
      return accounts.data;
    } catch (err) {
      this.logger.error(`Wallet retrieval failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to retrieve wallets with crypto provider.',
      );
    }
  }

  async addWithdrawalAddress(
    data: {
      address: string;
      network: string;
      token: string;
      label: string;
      isDefault: boolean;
    },
    businessId: string,
    mode: 'live' | 'test',
  ) {
    const ccChain =
      WITHDRAWAL_CHAIN_MAP[data.network] || data.network.toLowerCase();

    const result = await this.cc.createRecipient(mode, {
      type: 'crypto_address',
      label: data.label,
      isDefault: data.isDefault,
      details: { chain: ccChain, address: data.address },
    });

    const recipient = result.data;
    const details = recipient.details;

    const saved = await this.withdrawalWalletRepo.save({
      id: recipient.id,
      business_id: businessId,
      mode,
      address: data.address,
      network: data.network as WithdrawalWalletNetwork,
      token: data.token as WithdrawalWalletToken,
      label: data.label,
      primary: details.isDefault,
    });

    this.logger.log(`Withdrawal address saved: ${saved.id}`);
    return { success: true, data: saved };
  }

  async getSavedWithdrawalAddresses(businessId: string, mode: 'live' | 'test') {
    return this.withdrawalWalletRepo.find({
      where: { business_id: businessId, mode },
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
      await this.cc.deleteRecipient(saved.mode, saved.id);
      await this.withdrawalWalletRepo.delete({ id: addressId });
    }

    return { success: true };
  }

  async initiateStableCoinWithdrawal(
    dto: InitiateStableCoinWithdrawalDto,
    businessId: string,
    mode: 'live' | 'test',
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

    const result = await this.cc.initiatePayout(mode, {
      recipientId: saved.id,
      amount: netAmount.toString(),
      currency: dto.token,
      narration: dto.externalId,
    });

    const payoutId: string = result.data?.id;

    const token = dto.token.toUpperCase();
    const isUSDT = token === 'USDT';
    const isUSDC = token === 'USDC';
    const withdrawalCurrency = isUSDT
      ? LedgerCurrency.USDT
      : isUSDC
        ? LedgerCurrency.USDC
        : LedgerCurrency.NGN;

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        business_id: businessId,
        mode,
        tx_type: TxType.WITHDRAWAL,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        currency: withdrawalCurrency,
        debit_ngn: isStablecoin ? 0 : netAmount,
        debit_usdt: isUSDT ? netAmount : 0,
        debit_usdc: isUSDC ? netAmount : 0,
        credit_ngn: 0,
        asset: dto.token,
        status: LedgerEntryStatus.PENDING,
        description: `${dto.token} withdrawal to ${dto.address}`,
      }),
    );

    const platformBusinessId = this.platformCtx.getBusinessId();
    await this.ledgerRepo.save([
      this.ledgerRepo.create({
        business_id: businessId,
        mode,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        currency: withdrawalCurrency,
        debit_ngn: isStablecoin ? 0 : feeAmount,
        debit_usdt: isUSDT ? feeAmount : 0,
        debit_usdc: isUSDC ? feeAmount : 0,
        credit_ngn: 0,
        asset: dto.token,
        status: LedgerEntryStatus.COMPLETED,
        description: `${this.STABLECOIN_FEE_PERCENT}% withdrawal fee`,
      }),
      this.ledgerRepo.create({
        business_id: platformBusinessId,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        currency: withdrawalCurrency,
        credit_ngn: isStablecoin ? 0 : feeAmount,
        credit_usdt: isUSDT ? feeAmount : 0,
        credit_usdc: isUSDC ? feeAmount : 0,
        debit_ngn: 0,
        asset: dto.token,
        mode,
        status: LedgerEntryStatus.COMPLETED,
        description: `Fee income: ${this.STABLECOIN_FEE_PERCENT}% stablecoin withdrawal`,
      }),
    ]);

    this.logger.log(`Stablecoin withdrawal initiated: ${payoutId}`);
    return { ...result, fee: feeAmount, net_amount: netAmount };
  }

  async initiateFiatWithdrawal(
    dto: InitiateFiatWithdrawalDto,
    businessId: string,
    mode: 'live' | 'test',
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
      .andWhere('ledger.business_id = :businessId', { businessId })
      .getRawOne();

    if ((calculatedBalance.balance ?? 0) < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const result = await this.cc.initiatePayout(mode, {
      recipientId: dto.bank_id,
      amount: netAmount.toString(),
      currency: 'NGN',
      narration: dto.narration,
    });

    const payoutId: string = result.data.id;

    await this.payoutRepo.save(
      this.payoutRepo.create({
        business_id: businessId,
        mode,
        amount: dto.amount,
        fee: feeAmount,
        narration: dto.narration,
        status: PayoutStatus.PENDING,
        provider_payout_id: payoutId,
        metadata: { recipientId: dto.bank_id },
      }),
    );

    const platformBusinessId = this.platformCtx.getBusinessId();
    await this.ledgerRepo.save([
      this.ledgerRepo.create({
        business_id: businessId,
        mode,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        currency: LedgerCurrency.NGN,
        debit_ngn: feeAmount,
        credit_ngn: 0,
        asset: 'NGN',
        status: LedgerEntryStatus.COMPLETED,
        description: `${this.FIAT_WITHDRAWAL_FEE_PERCENT}% withdrawal fee`,
      }),
      this.ledgerRepo.create({
        business_id: platformBusinessId,
        tx_type: TxType.FEE,
        reference_type: 'withdrawal',
        reference_id: payoutId,
        currency: LedgerCurrency.NGN,
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

  async listPayouts(
    mode: 'live' | 'test',
    options: { page: string; size: string },
  ) {
    return this.cc.listPayouts(mode, {
      page: options.page,
      limit: options.size,
    });
  }
}
