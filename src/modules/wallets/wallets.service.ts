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
import { parsePagination, buildPaginationMeta } from '../../common/utils';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly breetApiUrl: string;
  private readonly breetApiKey: string;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.breetApiUrl = this.config.get<string>('breet.apiUrl') || '';
    this.breetApiKey = this.config.get<string>('breet.apiKey') || '';
  }

  async create(developerId: string, dto: CreateWalletDto) {
    const existing = await this.walletRepo.findOne({
      where: {
        developer_id: developerId,
        external_user_id: dto.external_user_id,
        asset: dto.asset,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Wallet for user ${dto.external_user_id} with asset ${dto.asset} already exists.`,
      );
    }

    let breetWallet: any = null;
    try {
      breetWallet = await this.createBreetWallet(dto);
    } catch (err) {
      this.logger.error(`Breet wallet creation failed: ${err.message}`);
      throw new BadRequestException(
        'Failed to create wallet with crypto provider.',
      );
    }

    const wallet = this.walletRepo.create({
      developer_id: developerId,
      external_user_id: dto.external_user_id,
      asset: dto.asset,
      deposit_address: breetWallet?.address || null,
      breet_wallet_id: breetWallet?.id || null,
      metadata: dto.metadata || {},
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

    if (query.external_user_id) {
      qb.andWhere('w.external_user_id = :uid', { uid: query.external_user_id });
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

  // ── Breet stubs ─────────────────────────────────────────
  private async createBreetWallet(dto: CreateWalletDto): Promise<any> {
    // TODO: Implement actual Breet API call
    this.logger.warn(
      'Using stub Breet wallet creation — implement actual API call',
    );
    return {
      id: `breet_${Date.now()}`,
      address: `0xSTUB_${dto.asset}_${Date.now().toString(36)}`,
    };
  }

  private async fetchBreetDepositAddress(
    breetWalletId: string,
  ): Promise<string> {
    // TODO: Implement actual Breet API call
    this.logger.warn(
      'Using stub Breet address fetch — implement actual API call',
    );
    return `0xSTUB_ADDRESS_${Date.now().toString(36)}`;
  }
}
