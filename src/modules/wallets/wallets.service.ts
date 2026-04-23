import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Wallet,
  LedgerEntry,
  TxType,
  WithdrawalWallet,
} from '../../database/entities';
import {
  CreateWalletDto,
  InitiateFiatWithdrawalDto,
  InitiateStableCoinWithdrawalDto,
  TransferDto,
  WalletQueryDto,
  WithdrawalNetwork,
  WithdrawalToken,
} from './dto';
import {
  parsePagination,
  buildPaginationMeta,
  generateUniqueId,
} from '../../common/utils';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly breetApiUrl: string;
  private readonly breetAppId: string;
  private readonly breetApiKey: string;
  private readonly breetEnv: string;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WithdrawalWallet)
    private readonly withdrawalWalletRepo: Repository<WithdrawalWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    this.breetApiUrl = this.config.get<string>('breet.apiUrl') || '';
    this.breetEnv = this.config.get<string>('breet.env') || '';
    this.breetAppId = isProduction
      ? this.config.get<string>('breet.appId') || ''
      : this.config.get<string>('breet.testAppId') || '';
    this.breetApiKey = isProduction
      ? this.config.get<string>('breet.secretKey') || ''
      : this.config.get<string>('breet.testSecretKey') || '';
  }

  async create(developerId: string, dto: CreateWalletDto) {
    const existing = await this.walletRepo.findOne({
      where: {
        developer_id: developerId,
        label: dto.label,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Wallet with label "${dto.label}" already exists for this developer.`,
      );
    }

    let breetWallet: any = null;
    const uniqueId = generateUniqueId();

    try {
      breetWallet = await this.createBreetWallet(dto, uniqueId);
    } catch (err) {
      this.logger.error(`Breet wallet creation failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to create wallet with crypto provider.',
      );
    }

    const wallet = this.walletRepo.create({
      id: breetWallet.data.id,
      developer_id: developerId,
      asset_id: dto.asset_id,
      deposit_address: breetWallet.data.address,
      label: dto.label,
    });

    return this.walletRepo.save(wallet);
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

    if (!wallet.deposit_address) {
      try {
        const addressData = await this.getBreetWalletDetails(wallet.id);
        await this.walletRepo.update(walletId, {
          deposit_address: addressData.data.address,
        });
        return {
          deposit_address: addressData.data.address,
          asset: wallet.asset_id,
        };
      } catch {
        throw new BadRequestException('Failed to generate deposit address.');
      }
    }

    return { deposit_address: wallet.deposit_address, asset: wallet.asset_id };
  }

  async getWalletDetails(breetWalletId: string): Promise<any> {
    try {
      const breetWallet = await this.getBreetWalletDetails(breetWalletId);
      return breetWallet.data;
    } catch (err) {
      this.logger.error(`Breet wallet retrieval failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to retrieve wallet with crypto provider.',
      );
    }
  }

  async getAllWalletDetails() {
    try {
      const breetWallets = await this.fetchAllBreetWalletDetails();
      return breetWallets.data;
    } catch (err) {
      this.logger.error(`Breet wallet retrieval failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to retrieve wallet with crypto provider.',
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

  async getTransactionsByWalletId(
    developerId: string,
    walletId: string,
    query: any,
  ) {
    const wallet = await this.findOne(developerId, walletId);

    if (!wallet.id) {
      throw new BadRequestException('Wallet is not linked to Breet.');
    }

    const { offset, limit, page } = parsePagination(query);

    const [entries, total] = await this.ledgerRepo.findAndCount({
      where: { developer_id: developerId, reference_id: walletId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      data: entries,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async transfer(developerId: string, dto: TransferDto) {
    const fromWallet = await this.findOne(developerId, dto.from_wallet_id);
    const toWallet = await this.findOne(developerId, dto.to_wallet_id);

    if (fromWallet.asset_id !== toWallet.asset_id) {
      throw new BadRequestException(
        'Cannot transfer between different asset types.',
      );
    }

    const available =
      Number(fromWallet.balance) - Number(fromWallet.locked_balance);
    if (available < dto.amount) {
      throw new BadRequestException('Insufficient balance for transfer.');
    }

    // Use transaction for atomicity
    const txId = crypto.randomUUID();

    await this.dataSource.transaction(async (manager) => {
      await manager.decrement(
        Wallet,
        { id: dto.from_wallet_id },
        'balance',
        dto.amount,
      );
      await manager.increment(
        Wallet,
        { id: dto.to_wallet_id },
        'balance',
        dto.amount,
      );

      await manager.save(LedgerEntry, [
        this.ledgerRepo.create({
          developer_id: developerId,
          tx_type: TxType.TRANSFER,
          reference_type: 'wallet_transfer',
          reference_id: dto.from_wallet_id,
          debit: dto.amount,
          credit: 0,
          currency: fromWallet.asset_id,
          description:
            dto.narration || `Transfer to wallet ${dto.to_wallet_id}`,
          metadata: { transfer_group: txId },
        }),
        this.ledgerRepo.create({
          developer_id: developerId,
          tx_type: TxType.TRANSFER,
          reference_type: 'wallet_transfer',
          reference_id: dto.to_wallet_id,
          debit: 0,
          credit: dto.amount,
          currency: toWallet.asset_id,
          description:
            dto.narration || `Transfer from wallet ${dto.from_wallet_id}`,
          metadata: { transfer_group: txId },
        }),
      ]);
    });

    return {
      transfer_id: txId,
      from_wallet_id: dto.from_wallet_id,
      to_wallet_id: dto.to_wallet_id,
      amount: dto.amount,
      asset: fromWallet.asset_id,
      status: 'completed',
    };
  }

  // ── Breet Wallet API Integration ────────────────────────
  private async createBreetWallet(
    dto: CreateWalletDto,
    uniqueId: string,
  ): Promise<any> {
    const url = `${this.breetApiUrl}/v1/trades/sell/assets/${dto.asset_id}/generate-address`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const body = {
      label: uniqueId,
      narration: 'Breet Payout',
      bankId: dto.bank_id,
      accountNumber: dto.account_number,
      autoSettlement: dto.auto_settlement,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      // console.log('response', response);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      console.log('data', data);
      this.logger.log(`Created Breet wallet: ${data.data.id}`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to create Breet wallet: ${error.message}`);
      throw error;
    }
  }

  private async getBreetWalletDetails(breetWalletId: string): Promise<any> {
    const url = `${this.breetApiUrl}/v1/trades/wallets/${breetWalletId}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.log(`Fetched deposit address for wallet ${breetWalletId}`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch deposit address: ${error.message}`);
      throw error;
    }
  }

  async syncWalletBalance(developerId: string, walletId: string) {
    const wallet = await this.findOne(developerId, walletId);

    if (!wallet.id) {
      throw new BadRequestException('Wallet is not linked to Breet.');
    }

    const breetBalance = await this.getBreetWalletBalance(wallet.id);

    // Update local wallet balance
    await this.walletRepo.update(walletId, {
      balance: parseFloat(breetBalance.balance),
    });

    // Log the balance sync
    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.DEPOSIT,
        reference_type: 'balance_sync',
        reference_id: walletId,
        debit: 0,
        credit: parseFloat(breetBalance.balance),
        currency: wallet.asset_id,
        description: `Balance sync from Breet: ${breetBalance.balance} ${wallet.asset_id}`,
      }),
    );

    return {
      wallet_id: walletId,
      asset: wallet.asset_id,
      balance: breetBalance.balance,
      synced_at: new Date(),
    };
  }

  // async getBreetWalletTransactions(
  //   options?: { limit?: number; offset?: number },
  // ) {
  //
  // }

  // async getBreetWalletTransactionsById(
  //   breetWalletId: string,
  //   options?: { limit?: number; offset?: number },
  // ) {
  //   // const params = new URLSearchParams();
  //   // if (options?.limit) params.append('limit', options.limit.toString());
  //   // if (options?.offset) params.append('offset', options.offset.toString());

  //   const url = `${this.breetApiUrl}/v1/trades/transactions/${breetWalletId}`;
  //   const headers = {
  //     'x-app-id': this.breetAppId,
  //     'x-app-secret': this.breetApiKey,
  //     'X-Breet-Env': this.breetEnv,
  //     'Content-Type': 'application/json',
  //   };

  //   try {
  //     const response = await fetch(url, {
  //       method: 'GET',
  //       headers,
  //     });

  //     if (!response.ok) {
  //       const error = await response.json();
  //       throw new Error(
  //         `Breet API error: ${error.message || response.statusText}`,
  //       );
  //     }

  //     return await response.json();
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to fetch wallet transactions: ${error.message}`,
  //     );
  //     throw error;
  //   }
  // }

  async mockBreetTrade(
    developerId: string,
    // walletId: string,
    mockData: {
      walletAddress: string;
      asset: string;
      amountInUSD: number;
      cryptoReceived: number;
      reference?: string;
      txHash?: string;
      sourceAddress?: string;
      confirmations?: number;
    },
  ) {
    // const wallet = await this.findOne(developerId, walletId);

    // if (!wallet.id) {
    //   throw new BadRequestException('Wallet is not linked to Breet.');
    // }

    // Check if we're in development environment
    if (this.breetEnv !== 'development') {
      throw new BadRequestException(
        'Mock trades are only available in development environment.',
      );
    }

    const url = `${this.breetApiUrl}/v1/trades/sell/mock-trade`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    // Generate unique reference and txHash if not provided
    const payload = {
      walletAddress: mockData.walletAddress,
      asset: mockData.asset,
      amountInUSD: mockData.amountInUSD,
      cryptoReceived: mockData.cryptoReceived,
      reference:
        mockData.reference ||
        `mock-ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      txHash:
        mockData.txHash ||
        `0xmock${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
      ...(mockData.sourceAddress && { sourceAddress: mockData.sourceAddress }),
      ...(mockData.confirmations && { confirmations: mockData.confirmations }),
    };

    try {
      this.logger.log(
        `Mocking trade for wallet ${mockData.walletAddress}: ${JSON.stringify(payload)}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();

      this.logger.log(
        `Mock trade accepted for wallet ${mockData.walletAddress}. Trade will be processed asynchronously.`,
      );

      // Log the mock trade in ledger for tracking
      await this.ledgerRepo.save(
        this.ledgerRepo.create({
          developer_id: developerId,
          tx_type: TxType.DEPOSIT,
          reference_type: 'mock_trade',
          reference_id: mockData.walletAddress,
          debit: 0,
          credit: mockData.cryptoReceived,
          currency: mockData.asset,
          description: `Mock trade: ${mockData.cryptoReceived} ${mockData.asset} (${mockData.amountInUSD} USD)`,
        }),
      );

      return {
        success: true,
        message: 'Mock trade accepted and will be processed asynchronously',
        trade: {
          walletAddress: payload.walletAddress,
          asset: payload.asset,
          amountInUSD: payload.amountInUSD,
          cryptoReceived: payload.cryptoReceived,
          reference: payload.reference,
          txHash: payload.txHash,
        },
        breet_response: result,
      };
    } catch (error) {
      this.logger.error(`Failed to mock trade: ${error.message}`);
      throw error;
    }
  }

  async getBreetWalletBalance(
    breetWalletId: string,
  ): Promise<{ asset: string; balance: string }> {
    const url = `${this.breetApiUrl}/v1/wallets/${breetWalletId}/balance`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch wallet balance: ${error.message}`);
      throw error;
    }
  }

  // 1. Add withdrawal address
  async addWithdrawalAddress(
    withdrawalData: {
      address: string;
      network: string;
      token: string;
      label: string;
    },
    developerId: string,
  ) {
    const url = `${this.breetApiUrl}/v1/payments/wallet-addresses`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const payload = {
      address: withdrawalData.address,
      network: withdrawalData.network,
      token: withdrawalData.token,
      label: withdrawalData.label,
    };

    try {
      this.logger.log(`Adding withdrawal address: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Withdrawal address added successfully`);

      const savedWithdrawalAddress = await this.withdrawalWalletRepo.save({
        id: result.data._id,
        developer_id: developerId,
        address: result.data.address,
        network: result.data.network,
        token: result.data.token,
        label: result.data.label,
        avatar: result.data.avatar,
      });
      this.logger.log(
        `Withdrawal address saved to local database: ${savedWithdrawalAddress.id}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to add withdrawal address: ${error.message}`);
      throw error;
    }
  }

  // Get saved withdrawal address
  async getSavedWithdrawalAddresses(developerId: string) {
    return this.withdrawalWalletRepo.find({
      where: {
        developer_id: developerId,
      },
    });
  }

  // 2. Fetch breet withdrawal addresses
  async getWithdrawalAddresses() {
    const url = `${this.breetApiUrl}/v1/payments/wallet-addresses`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const addresses = await response.json();
      this.logger.log(`Fetched ${addresses.data.length} withdrawal addresses`);

      return addresses;
    } catch (error) {
      this.logger.error(
        `Failed to fetch withdrawal addresses: ${error.message}`,
      );
      throw error;
    }
  }

  // 3. Remove withdrawal address
  async removeWithdrawalAddress(addressId: string) {
    const url = `${this.breetApiUrl}/v1/payments/wallet-addresses/${addressId}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const selectedWithdrawalAddress = await this.withdrawalWalletRepo.findOne({
      where: { address: addressId },
    });

    // if (!selectedWithdrawalAddress) {
    //   throw new NotFoundException('Withdrawal address not found');
    // }

    try {
      this.logger.log(`Removing withdrawal address: ${addressId}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Withdrawal address removed successfully`);

      await this.withdrawalWalletRepo.delete({ address: addressId });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to remove withdrawal address: ${error.message}`,
      );
      throw error;
    }
  }

  // Initiate and fetch withdrawals
  async initiateStableCoinWithdrawal(
    withdrawalDto: InitiateStableCoinWithdrawalDto,
  ) {
    const url = `${this.breetApiUrl}/v1/payments/withdraw/address`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    if (
      withdrawalDto.network === WithdrawalNetwork.TON &&
      withdrawalDto.token === WithdrawalToken.USDC
    ) {
      throw new BadRequestException('USDC is not supported on TON');
    }

    const uniqueId = generateUniqueId();

    const payload = {
      walletAddress: withdrawalDto.address,
      network: withdrawalDto.network,
      token: withdrawalDto.token,
      amount: withdrawalDto.amount,
      pin: withdrawalDto?.pin || this.config.get<string>('app.pin'),
      externalId: withdrawalDto.externalId || uniqueId,
    };

    try {
      this.logger.log(
        `Initiating stablecoin withdrawal: ${JSON.stringify(payload)}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Stablecoin withdrawal initiated successfully`);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to initiate stablecoin withdrawal: ${error.message}`,
      );
      throw error;
    }
  }

  async initiateFiatWithdrawal(withdrawalDto: InitiateFiatWithdrawalDto) {
    const url = `${this.breetApiUrl}/v1/payments/withdraw/bank/${withdrawalDto.bank_id}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const payload = {
      amount: withdrawalDto.amountInUSD,
      narration: withdrawalDto.narration,
      pin: withdrawalDto?.pin || this.config.get<string>('app.pin'),
    };

    try {
      this.logger.log(`Initiating fiat withdrawal: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Fiat withdrawal initiated successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to initiate fiat withdrawal: ${error.message}`);
      throw error;
    }
  }

  async getBreetWithdrawals(options: { page: string; size: string }) {
    const params = new URLSearchParams();
    params.append('page', options.page);
    params.append('size', options.size);
    const url = `${this.breetApiUrl}/v1/payments/withdrawals?${params.toString()}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      this.logger.log(`Getting Breet withdrawals`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Breet withdrawals retrieved successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to get Breet withdrawals: ${error.message}`);
      throw error;
    }
  }

  protected async fetchAllBreetWalletDetails(): Promise<any> {
    const url = `${this.breetApiUrl}/v1/trades/wallets`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.log(`Fetched all Breet wallet details`);
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch all Breet wallet details: ${error.message}`,
      );
      throw error;
    }
  }
}
