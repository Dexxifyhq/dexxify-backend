import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OnrampTransaction,
  TxStatus,
  LedgerEntry,
  TxType,
} from '../../database/entities';
import { CreateOnrampDto } from './dto';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class OnrampService {
  private readonly logger = new Logger(OnrampService.name);
  private readonly FEE_PERCENT = 1.5;
  private readonly SPREAD_PERCENT = 0.75;

  constructor(
    @InjectRepository(OnrampTransaction)
    private readonly onrampRepo: Repository<OnrampTransaction>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly config: ConfigService,
    private readonly walletsService: WalletsService,
  ) {}

  async create(developerId: string, dto: CreateOnrampDto) {
    const wallet = await this.walletsService.findOne(
      developerId,
      dto.wallet_id,
    );

    if (wallet.asset !== dto.crypto_asset) {
      throw new BadRequestException(
        'Wallet asset does not match requested crypto asset.',
      );
    }

    // Get rate and apply spread (worse rate for buyer = higher price per crypto)
    const baseRate = await this.fetchBreetRate(dto.crypto_asset, 'NGN');
    const spreadRate = baseRate * (1 + this.SPREAD_PERCENT / 100);
    const feeNgn = dto.ngn_amount * (this.FEE_PERCENT / 100);
    const netNgn = dto.ngn_amount - feeNgn;
    const cryptoAmount = netNgn / spreadRate;

    const onramp = this.onrampRepo.create({
      developer_id: developerId,
      wallet_id: dto.wallet_id,
      crypto_asset: dto.crypto_asset,
      ngn_amount: dto.ngn_amount,
      exchange_rate: spreadRate,
      crypto_amount: cryptoAmount,
      fee_ngn: feeNgn,
      payment_reference: dto.payment_reference,
      status: TxStatus.PROCESSING,
      metadata: dto.metadata || {},
    });

    const saved = await this.onrampRepo.save(onramp);

    // TODO: Queue async — verify payment, trigger Breet crypto purchase, credit wallet
    this.logger.log(`Onramp ${saved.id} created — queue Breet crypto purchase`);

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.ONRAMP,
        reference_type: 'onramp',
        reference_id: saved.id,
        debit: dto.ngn_amount,
        credit: 0,
        currency: 'NGN',
        description: `Onramp ₦${dto.ngn_amount} → ${cryptoAmount.toFixed(8)} ${dto.crypto_asset}`,
      }),
    );

    return saved;
  }

  async findOne(developerId: string, txId: string) {
    const tx = await this.onrampRepo.findOne({
      where: { id: txId, developer_id: developerId },
    });
    if (!tx) throw new NotFoundException('Onramp transaction not found.');
    return tx;
  }

  // ── Breet stub ────────────────────────────────────────
  private async fetchBreetRate(base: string, _quote: string): Promise<number> {
    // TODO: Replace with actual Breet API call
    this.logger.warn('Using stub Breet rate — implement actual API call');
    const stubRates: Record<string, number> = {
      USDT: 1580,
      BTC: 68000000,
      ETH: 5700000,
      USDC: 1580,
    };
    return stubRates[base] || 1580;
  }
}
