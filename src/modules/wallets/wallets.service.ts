import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, LedgerEntry, TxType } from '../../database/entities';
import { CreateWalletDto, TransferDto, WalletQueryDto } from './dto';
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
        breet_wallet_id: dto.wallet_id,
        asset: dto.asset,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Wallet for user ${dto.wallet_id} with asset ${dto.asset} already exists.`,
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

    // const wallet = this.walletRepo.create({
    //   developer_id: developerId,
    //   breet_wallet_id: breetWallet.id,
    //   asset: dto.asset,
    //   deposit_address: breetWallet.address,
    // });

    // return this.walletRepo.save(wallet);
    return;
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
      qb.andWhere('w.breet_wallet_id = :uid', { uid: query.wallet_id });
    }
    if (query.asset) {
      qb.andWhere('w.asset = :asset', { asset: query.asset });
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
        const address = await this.fetchBreetDepositAddress(
          wallet.breet_wallet_id,
        );
        await this.walletRepo.update(walletId, { deposit_address: address });
        return { address, asset: wallet.asset };
      } catch {
        throw new BadRequestException('Failed to generate deposit address.');
      }
    }

    return { address: wallet.deposit_address, asset: wallet.asset };
  }

  async getTransactions(developerId: string, walletId: string, query: any) {
    await this.findOne(developerId, walletId);

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

    if (fromWallet.asset !== toWallet.asset) {
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
          currency: fromWallet.asset,
          balance_after: Number(fromWallet.balance) - dto.amount,
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
          currency: toWallet.asset,
          balance_after: Number(toWallet.balance) + dto.amount,
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
      asset: fromWallet.asset,
      status: 'completed',
    };
  }

  // ── Breet Wallet API Integration ────────────────────────
  private async createBreetWallet(
    dto: CreateWalletDto,
    uniqueId: string,
  ): Promise<any> {
    const url = `${this.breetApiUrl}/v1/trades/sell/assets/${dto.asset}/generate-address`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const body = {
      asset: dto.asset.toLowerCase(), // Breet expects lowercase (btc, usdt, eth, usdc)
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
      console.log('response', response);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      console.log('data', data);
      this.logger.log(`Created Breet wallet: ${data.id}`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to create Breet wallet: ${error.message}`);
      throw error;
    }
  }

  private async fetchBreetDepositAddress(
    breetWalletId: string,
  ): Promise<string> {
    const url = `${this.breetApiUrl}/wallets/${breetWalletId}/address`;
    const headers = {
      Authorization: `Bearer ${this.breetApiKey}`,
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
      return data.address;
    } catch (error) {
      this.logger.error(`Failed to fetch deposit address: ${error.message}`);
      throw error;
    }
  }

  async syncWalletBalance(developerId: string, walletId: string) {
    const wallet = await this.findOne(developerId, walletId);

    if (!wallet.breet_wallet_id) {
      throw new BadRequestException('Wallet is not linked to Breet.');
    }

    const breetBalance = await this.getBreetWalletBalance(
      wallet.breet_wallet_id,
    );

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
        currency: wallet.asset,
        description: `Balance sync from Breet: ${breetBalance.balance} ${wallet.asset}`,
      }),
    );

    return {
      wallet_id: walletId,
      asset: wallet.asset,
      balance: breetBalance.balance,
      synced_at: new Date(),
    };
  }

  async getBreetTransactions(
    developerId: string,
    walletId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const wallet = await this.findOne(developerId, walletId);

    if (!wallet.breet_wallet_id) {
      throw new BadRequestException('Wallet is not linked to Breet.');
    }

    return this.getBreetWalletTransactions(wallet.breet_wallet_id, options);
  }

  async getBreetWalletBalance(
    breetWalletId: string,
  ): Promise<{ asset: string; balance: string }> {
    const url = `${this.breetApiUrl}/wallets/${breetWalletId}/balance`;
    const headers = {
      Authorization: `Bearer ${this.breetApiKey}`,
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

  async getBreetWalletTransactions(
    breetWalletId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const url = `${this.breetApiUrl}/wallets/${breetWalletId}/transactions?${params}`;
    const headers = {
      Authorization: `Bearer ${this.breetApiKey}`,
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

      return await response.json();
    } catch (error) {
      this.logger.error(
        `Failed to fetch wallet transactions: ${error.message}`,
      );
      throw error;
    }
  }
}
