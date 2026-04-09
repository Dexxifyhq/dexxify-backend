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
  OfframpTransaction,
  TxStatus,
  Wallet,
  LedgerEntry,
  TxType,
} from '../../database/entities';
import { CreateOfframpDto } from './dto';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class OfframpService {
  private readonly logger = new Logger(OfframpService.name);
  private readonly FEE_PERCENT = 1.5;
  private readonly SPREAD_PERCENT = 0.75;

  constructor(
    @InjectRepository(OfframpTransaction)
    private readonly offrampRepo: Repository<OfframpTransaction>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly config: ConfigService,
    private readonly walletsService: WalletsService,
  ) {}

  async getRate(pair: string) {
    const [base, quote] = pair.toUpperCase().split('_');
    if (!base || !quote) {
      throw new BadRequestException('Invalid pair format. Use e.g. USDT_NGN');
    }

    const baseRate = await this.fetchBreetRate(base, quote);
    const spreadAmount = baseRate * (this.SPREAD_PERCENT / 100);
    const rateWithSpread = baseRate - spreadAmount;

    return {
      pair: `${base}/${quote}`,
      rate: rateWithSpread,
      base_rate: baseRate,
      spread: this.SPREAD_PERCENT,
      valid_for_seconds: 30,
      timestamp: new Date().toISOString(),
    };
  }

  async create(developerId: string, dto: CreateOfframpDto) {
    const wallet = await this.walletsService.findOne(
      developerId,
      dto.wallet_id,
    );

    if (wallet.asset_id !== dto.crypto_asset) {
      throw new BadRequestException(
        'Wallet asset does not match requested crypto asset.',
      );
    }

    const available = Number(wallet.balance) - Number(wallet.locked_balance);
    if (available < dto.crypto_amount) {
      throw new BadRequestException('Insufficient wallet balance.');
    }

    const rate = await this.fetchBreetRate(dto.crypto_asset, 'NGN');
    const spreadRate = rate * (1 - this.SPREAD_PERCENT / 100);
    const grossNgn = dto.crypto_amount * spreadRate;
    const feeNgn = grossNgn * (this.FEE_PERCENT / 100);
    const netNgn = grossNgn - feeNgn;

    // Lock funds
    await this.walletRepo.increment(
      { id: dto.wallet_id },
      'locked_balance',
      dto.crypto_amount,
    );

    const offramp = this.offrampRepo.create({
      developer_id: developerId,
      wallet_id: dto.wallet_id,
      crypto_asset: dto.crypto_asset,
      crypto_amount: dto.crypto_amount,
      exchange_rate: spreadRate,
      ngn_amount: netNgn,
      fee_ngn: feeNgn,
      destination_bank_code: dto.bank_code,
      destination_account_number: dto.account_number,
      destination_account_name: dto.account_name,
      status: TxStatus.PROCESSING,
      metadata: dto.metadata || {},
    });

    const saved = await this.offrampRepo.save(offramp);

    // TODO: Queue async Breet conversion + Paystack payout via BullMQ
    this.logger.log(`Offramp ${saved.id} created — queue Breet conversion`);

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.OFFRAMP,
        reference_type: 'offramp',
        reference_id: saved.id,
        debit: dto.crypto_amount,
        credit: 0,
        currency: dto.crypto_asset,
        description: `Offramp ${dto.crypto_amount} ${dto.crypto_asset} → ₦${netNgn.toFixed(2)}`,
      }),
    );

    return saved;
  }

  async findOne(developerId: string, txId: string) {
    const tx = await this.offrampRepo.findOne({
      where: { id: txId, developer_id: developerId },
    });
    if (!tx) throw new NotFoundException('Offramp transaction not found.');
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
