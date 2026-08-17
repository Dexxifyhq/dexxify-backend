import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import {
  STABLECOIN_FEE,
  CC_STABLECOIN_FEE,
  FIAT_WITHDRAWAL_FEE,
} from '../../common/constants/fees.constants';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { PlatformContextService } from '../platform/platform-context.service';
import {
  WithdrawalWalletNetwork,
  WithdrawalWalletToken,
} from '../../database/entities/withdrawal-wallet.entity';
import { CustomersService } from '../customers/customers.service';

export interface CCDepositAddress {
  chain: string;
  address: string;
  createdAt: string;
}

export interface CCNgnVirtualAccount {
  currency: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  accountReference: string;
  createdAt: string;
}

export interface CCDepositAccountData {
  id: string;
  staticDepositAddresses?: CCDepositAddress[];
  ngnVirtualAccounts?: CCNgnVirtualAccount[];
}

interface CCRecipientDetails {
  chain?: string;
  address?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  accountType?: string;
  currency?: string;
}

interface CCRecipient {
  id: string;
  isDefault?: boolean;
  label?: string;
  details: CCRecipientDetails;
}

interface CCPayoutData {
  id: string;
  [key: string]: unknown;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly dataSource: DataSource,
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
      const ccAccount = account.data as CCDepositAccountData;
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
    } catch (err: unknown) {
      this.logger.error(
        `Deposit account creation failed: ${getErrorMessage(err)}`,
      );
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
        const data = account.data as CCDepositAccountData | undefined;
        const addresses = data?.staticDepositAddresses || [];
        const ngnAccounts = data?.ngnVirtualAccounts || [];
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
  ): Promise<CCDepositAccountData> {
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

    const account = result.data as CCDepositAccountData;

    await this.walletRepo.update(walletId, {
      deposit_addresses: account.staticDepositAddresses ?? [],
      ngn_virtual_accounts: account.ngnVirtualAccounts ?? [],
    });

    return account;
  }

  async getWalletDetails(walletId: string): Promise<CCDepositAccountData> {
    try {
      const account = await this.cc.getDepositAccount('live', walletId);
      return account.data as CCDepositAccountData;
    } catch (err: unknown) {
      this.logger.error(`Wallet retrieval failed: ${getErrorMessage(err)}`);
      throw new BadRequestException(
        'Failed to retrieve wallet with crypto provider.',
      );
    }
  }

  async getAllWalletDetails(): Promise<CCDepositAccountData[]> {
    try {
      const accounts = await this.cc.listDepositAccounts('live');
      return accounts.data as CCDepositAccountData[];
    } catch (err: unknown) {
      this.logger.error(`Wallet retrieval failed: ${getErrorMessage(err)}`);
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
    const ccChain = data.network;

    const result = await this.cc.createRecipient(mode, {
      type: 'crypto_address',
      label: data.label,
      isDefault: data.isDefault,
      details: { chain: ccChain, address: data.address },
    });

    const recipient = result.data as CCRecipient;

    const saved = await this.withdrawalWalletRepo.save({
      id: recipient.id,
      business_id: businessId,
      mode,
      address: data.address,
      network: ccChain as WithdrawalWalletNetwork,
      token: data.token as WithdrawalWalletToken,
      label: data.label,
      primary: recipient.isDefault,
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

    const feeAmount = STABLECOIN_FEE + CC_STABLECOIN_FEE;
    const platformFee = STABLECOIN_FEE;
    const totalAmount = dto.amount + feeAmount;
    const ccNetAmount = dto.amount - platformFee;
    const token = dto.token.toUpperCase();
    const isUSDT = token === 'USDT';
    const isUSDC = token === 'USDC';
    const withdrawalCurrency = isUSDT
      ? LedgerCurrency.USDT
      : LedgerCurrency.USDC;

    // Credits: completed/reversed/rejected. Debits: completed + pending (to block double-spend)
    const creditCol = isUSDT ? 'le.credit_usdt' : 'le.credit_usdc';
    const debitCol = isUSDT ? 'le.debit_usdt' : 'le.debit_usdc';

    const calculatedBalance = await this.ledgerRepo
      .createQueryBuilder('le')
      .select(
        `SUM(CASE WHEN le.status IN ('completed','reversed','rejected') THEN ${creditCol} ELSE 0 END)
         - SUM(CASE WHEN le.status IN ('completed','pending') THEN ${debitCol} ELSE 0 END)`,
        'balance',
      )
      .where('le.business_id = :businessId', { businessId })
      .andWhere('le.mode = :mode', { mode })
      .getRawOne<{ balance: string | null }>();

    if (Number(calculatedBalance?.balance ?? 0) < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // CC call outside transaction — if it fails nothing is written
    const result = await this.cc.initiatePayout(mode, {
      recipientId: saved.id,
      amount: ccNetAmount.toString(),
      currency: dto.token,
      narration: dto.externalId,
    });

    const payoutId = (result.data as CCPayoutData).id;
    const platformBusinessId = this.platformCtx.getBusinessId();

    await this.dataSource.transaction(async (em) => {
      const payout = await em.getRepository(Payout).save(
        em.getRepository(Payout).create({
          business_id: businessId,
          mode,
          amount: dto.amount,
          fee: feeAmount,
          status: PayoutStatus.PENDING,
          provider_payout_id: payoutId,
          metadata: { recipientId: saved.id },
        }),
      );

      // Developer debit — PENDING until webhook confirms delivery
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: businessId,
          mode,
          tx_type: TxType.WITHDRAWAL,
          reference_type: 'payout',
          reference_id: payout.id,
          currency: withdrawalCurrency,
          debit_usdt: isUSDT ? totalAmount : 0,
          debit_usdc: isUSDC ? totalAmount : 0,
          asset: dto.token,
          status: LedgerEntryStatus.PENDING,
          description: `Stablecoin withdrawal: ${dto.amount} ${token}`,
        }),
      );

      // Platform fee — recognised immediately
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: platformBusinessId,
          mode,
          tx_type: TxType.FEE,
          reference_type: 'payout_fee',
          reference_id: `${payout.id}_fee`,
          currency: withdrawalCurrency,
          credit_usdt: isUSDT ? platformFee : 0,
          credit_usdc: isUSDC ? platformFee : 0,
          asset: dto.token,
          status: LedgerEntryStatus.PENDING,
          description: `Fee income: ${STABLECOIN_FEE} stablecoin withdrawal`,
        }),
      );
    });

    this.logger.log(`Stablecoin withdrawal initiated: ${payoutId}`);
    return { fee: feeAmount, amount: dto.amount };
  }

  async initiateFiatWithdrawal(
    dto: InitiateFiatWithdrawalDto,
    businessId: string,
    mode: 'live' | 'test',
  ) {
    const feeAmount = FIAT_WITHDRAWAL_FEE;
    // const totalAmount = dto.amount + feeAmount;
    const netAmount = dto.amount - feeAmount;

    // Credits: completed/reversed/rejected. Debits: completed + pending (to block double-spend)
    const calculatedBalance = await this.ledgerRepo
      .createQueryBuilder('le')
      .select(
        `SUM(CASE WHEN le.status IN ('completed','reversed','rejected') THEN le.credit_ngn ELSE 0 END)
         - SUM(CASE WHEN le.status IN ('completed','pending') THEN le.debit_ngn ELSE 0 END)`,
        'balance',
      )
      .where('le.business_id = :businessId', { businessId })
      .andWhere('le.currency = :currency', { currency: 'NGN' })
      .andWhere('le.mode = :mode', { mode })
      .getRawOne<{ balance: string | null }>();

    if (Number(calculatedBalance?.balance ?? 0) < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // CC call outside transaction — if it fails nothing is written
    const result = await this.cc.initiatePayout(mode, {
      recipientId: dto.bank_id,
      amount: netAmount.toString(),
      currency: 'NGN',
      narration: dto.narration,
    });

    const payoutId = (result.data as CCPayoutData).id;
    const platformBusinessId = this.platformCtx.getBusinessId();

    await this.dataSource.transaction(async (em) => {
      const payout = await em.getRepository(Payout).save(
        em.getRepository(Payout).create({
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

      // Developer debit — PENDING until webhook confirms delivery
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: businessId,
          mode,
          tx_type: TxType.WITHDRAWAL,
          reference_type: 'payout',
          reference_id: payout.id,
          currency: LedgerCurrency.NGN,
          debit_ngn: dto.amount,
          asset: 'NGN',
          status: LedgerEntryStatus.PENDING,
          description: `Fiat withdrawal: ${dto.amount} NGN`,
        }),
      );

      // Platform fee — recognised immediately
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: platformBusinessId,
          mode,
          tx_type: TxType.FEE,
          reference_type: 'payout_fee',
          reference_id: `${payout.id}_fee`,
          currency: LedgerCurrency.NGN,
          credit_ngn: feeAmount,
          asset: 'NGN',
          status: LedgerEntryStatus.PENDING,
          description: `Fee income: ${FIAT_WITHDRAWAL_FEE} fiat withdrawal`,
        }),
      );
    });

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
