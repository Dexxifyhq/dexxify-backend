import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LedgerEntry,
  LedgerEntryStatus,
  TxType,
  Wallet,
  OfframpTransaction,
  OnrampTransaction,
  TxStatus,
} from '../../database/entities';

export enum BreetWebhookEventType {
  TRADE_PENDING = 'trade.pending',
  TRADE_COMPLETED = 'trade.completed',
  TRADE_FLAGGED = 'trade.flagged',
  WITHDRAWAL_PENDING = 'withdrawal.pending',
  WITHDRAWAL_PROCESSING = 'withdrawal.processing',
  WITHDRAWAL_COMPLETED = 'withdrawal.completed',
  WITHDRAWAL_REVERSED = 'withdrawal.reversed',
  WITHDRAWAL_REJECTED = 'withdrawal.rejected',
}

const BREET_ALLOWED_IPS = [
  '46.101.201.155',
  '46.101.225.109',
  '46.101.225.97',
  '46.101.225.251',
  '159.89.20.62',
];

@Injectable()
export class BreetWebhooksService {
  private readonly logger = new Logger(BreetWebhooksService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,

    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(OfframpTransaction)
    private readonly offrampRepo: Repository<OfframpTransaction>,

    @InjectRepository(OnrampTransaction)
    private readonly onrampRepo: Repository<OnrampTransaction>,
  ) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    this.webhookSecret = isProduction
      ? this.config.get<string>('breet.webhookSecret') || ''
      : this.config.get<string>('breet.testWebhookSecret') || '';
  }

  /**
   * Verify Breet webhook request
   * - IP whitelist check
   * - Secret header verification
   */
  verifyWebhookRequest(req: Request): { isValid: boolean; error?: string } {
    const ip = this.extractClientIp(req);
    if (!BREET_ALLOWED_IPS.includes(ip)) {
      this.logger.warn(`Unauthorized webhook IP: ${ip}`);
      return { isValid: false, error: 'Invalid IP address' };
    }

    const secret = req.headers['x-webhook-secret'] as string;
    if (!secret || secret !== this.webhookSecret) {
      this.logger.warn('Invalid webhook secret');
      return { isValid: false, error: 'Invalid webhook secret' };
    }

    return { isValid: true };
  }

  /**
   * Process incoming Breet webhook
   * - Route to appropriate handler
   */
  async processWebhook(
    payload: any,
    ip: string,
  ): Promise<{ processed: boolean; eventId: string }> {
    const eventId = payload.id;
    const eventType = payload.event;

    this.logger.log(`Processing webhook: ${eventType} (${eventId}) from ${ip}`);

    try {
      console.log('payload', payload);
      await this.handleEvent(eventType, payload);
      return { processed: true, eventId };
    } catch (error: any) {
      this.logger.error(
        `Failed to process webhook event ${eventId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Route webhook event to appropriate handler
   */
  private async handleEvent(eventType: string, payload: any): Promise<void> {
    switch (eventType) {
      case BreetWebhookEventType.TRADE_PENDING:
        await this.handleTradePending(payload);
        break;
      case BreetWebhookEventType.TRADE_COMPLETED:
        await this.handleTradeCompleted(payload);
        break;
      case BreetWebhookEventType.TRADE_FLAGGED:
        await this.handleTradeFlagged(payload);
        break;
      case BreetWebhookEventType.WITHDRAWAL_PENDING:
        await this.handleWithdrawalPending(payload);
        break;
      case BreetWebhookEventType.WITHDRAWAL_PROCESSING:
        await this.handleWithdrawalProcessing(payload);
        break;
      case BreetWebhookEventType.WITHDRAWAL_COMPLETED:
        await this.handleWithdrawalCompleted(payload);
        break;
      case BreetWebhookEventType.WITHDRAWAL_REVERSED:
        await this.handleWithdrawalReversed(payload);
        break;
      case BreetWebhookEventType.WITHDRAWAL_REJECTED:
        await this.handleWithdrawalRejected(payload);
        break;
      default:
        this.logger.warn(`Unknown event type: ${eventType}`);
    }
  }

  // Event handlers

  private async handleTradePending(payload: any): Promise<void | string> {
    this.logger.log(
      `Trade pending detected: ${payload.id}, asset: ${payload.asset}`,
    );

    const amountInNGN =
      payload.rate * payload.amountInUSD * (1 - payload.feePercentage);
    console.log('amountInNGN', amountInNGN);

    // Create/Update ledger entry as pending
    const ledgerEntry = await this.ledgerRepo.findOne({
      where: { reference_id: payload.id },
    });

    const developerWallet = await this.walletRepo.findOne({
      where: { deposit_address: payload.destinationAddress },
    });

    if (!developerWallet) {
      throw new NotFoundException('Developer wallet not found');
    }

    // if (developerWallet.auto_settled) {
    //   return "Funds auto-settled to user's bank account";
    // }

    const status = developerWallet.auto_settled
      ? LedgerEntryStatus.AUTO_SETTLED
      : LedgerEntryStatus.PENDING;

    if (ledgerEntry) {
      await this.ledgerRepo.manager.transaction(async (manager) => {
        await this.ledgerRepo.update({ reference_id: payload.id }, { status });
        await this.onrampRepo.update({ reference: payload.id }, { status });
      });
    }

    if (!ledgerEntry) {
      // Create new ledger entry and onramp transaction
      await this.ledgerRepo.manager.transaction(async (manager) => {
        const newEntry = this.ledgerRepo.create({
          developer_id: developerWallet.developer_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'dexxify_trade',
          reference_id: payload.id,
          amount_usd: payload.amountInUSD,
          amount_crypto: payload.cryptoAmount,
          debit_ngn: 0,
          credit_ngn: parseFloat(`${amountInNGN}`),
          wallet_address: payload.destinationAddress,
          asset: payload.asset,
          status,
          description: `Dexxify trade pending: ${payload.id}`,
          metadata: {
            ...payload,
          },
        });

        await manager.save(newEntry);

        const onrampTransaction = this.onrampRepo.create({
          developer_id: developerWallet.developer_id,
          reference: payload.id,
          status,
          usd_amount: payload.amountInUSD,
          crypto_amount: payload.cryptoAmount,
          fee_percentage: payload.feePercentage,
          exchange_rate: payload.rate,
          tx_hash: payload.txHash,
          wallet_address: payload.destinationAddress,
          crypto_asset: payload.asset,
          metadata: {
            ...payload,
          },
        });

        await manager.save(onrampTransaction);
      });
    }

    // TODO: Dispatch to developer webhooks: wallet.deposit.pending
  }

  private async handleTradeCompleted(payload: any): Promise<void> {
    this.logger.log(
      `Trade completed: ${payload.id}, amount: ${payload.amountInUSD} USD`,
    );
    // Credit wallet balance
    const ledgerEntry = await this.ledgerRepo.findOne({
      where: { reference_id: payload.id },
    });

    if (ledgerEntry) {
      const status =
        ledgerEntry.status === LedgerEntryStatus.AUTO_SETTLED
          ? LedgerEntryStatus.AUTO_SETTLED
          : LedgerEntryStatus.COMPLETED;

      await this.ledgerRepo.manager.transaction(async (manager) => {
        await this.ledgerRepo.update({ reference_id: payload.id }, { status });
        await this.onrampRepo.update({ reference: payload.id }, { status });
      });
    }
    // TODO: Dispatch to developer webhooks: wallet.deposit.completed
  }

  private async handleTradeFlagged(payload: any): Promise<void> {
    this.logger.log(
      `Trade flagged: ${payload.id}, amount: ${payload.amountInUSD} USD`,
    );

    const amountInNGN =
      payload.rate * payload.amountInUSD * (1 - payload.feePercentage);
    console.log('amountInNGN', amountInNGN);

    // Mark as flagged in ledger
    const ledgerEntry = await this.ledgerRepo.findOne({
      where: { reference_id: payload.id },
    });

    const developerWallet = await this.walletRepo.findOne({
      where: { deposit_address: payload.destinationAddress },
    });

    if (!developerWallet) {
      throw new NotFoundException('Developer wallet not found');
    }

    if (!ledgerEntry) {
      throw new NotFoundException('No ledger entry found for this transaction');
    }

    if (ledgerEntry) {
      await this.ledgerRepo.manager.transaction(async (manager) => {
        await this.ledgerRepo.update(
          { reference_id: payload.id },
          { status: LedgerEntryStatus.FLAGGED },
        );
        await this.onrampRepo.update(
          { reference: payload.id },
          { status: LedgerEntryStatus.FLAGGED },
        );
      });
    }

    // TODO: Dispatch to developer webhooks: wallet.deposit.flagged
  }

  private async handleWithdrawalPending(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal ${payload.status}: ${payload.id}, amount: ${payload.originalAmount}`,
    );

    const offrampEntry = await this.offrampRepo.findOne({
      where: { breet_reference: payload.id },
    });

    if (!offrampEntry) {
      throw new NotFoundException('Offramp entry not found');
    }

    await this.offrampRepo.manager.transaction(async (manager) => {
      await this.offrampRepo.update(
        { breet_reference: payload.id },
        {
          status: payload.status,
          fee: payload.meta.fee,
          currency: payload.currency,
          description: `Dexxify payout pending: ${payload.id}`,
          metadata: {
            ...payload.meta,
            reason: payload.reason,
          },
        },
      );

      // Create new ledger entry
      const ledgerEntry = this.ledgerRepo.create({
        developer_id: offrampEntry.developer_id,
        tx_type: TxType.WITHDRAWAL,
        reference_type: 'dexxify_payout',
        reference_id: payload.id,
        debit_ngn: parseFloat(payload.originalAmount),
        credit_ngn: 0,
        status: payload.status,
        description: `Dexxify payout ${payload.status}: ${payload.id}`,
        metadata: {
          ...payload.meta,
          reason: payload.reason,
        },
      });

      await manager.save(ledgerEntry);
    });

    // TODO: Dispatch to developer webhooks: withdrawal.pending
  }

  private async handleWithdrawalProcessing(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal ${payload.status}: ${payload.id}, amount: ${payload.originalAmount}`,
    );

    const offrampEntry = await this.offrampRepo.findOne({
      where: { breet_reference: payload.id },
    });

    if (!offrampEntry) {
      throw new NotFoundException('Offramp entry not found');
    }

    await this.offrampRepo.manager.transaction(async (manager) => {
      await this.offrampRepo.update(
        { breet_reference: payload.id },
        {
          status: payload.status,
        },
      );

      // Update ledger entry
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        {
          status: payload.status,
        },
      );
    });

    // TODO: Dispatch to developer webhooks: withdrawal.processing
  }

  private async handleWithdrawalCompleted(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal completed: ${payload.id}, amount: ${payload.originalAmount}`,
    );

    await this.offrampRepo.manager.transaction(async (manager) => {
      await this.offrampRepo.update(
        { breet_reference: payload.id },
        {
          status: payload.status,
        },
      );

      // Update ledger entry
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        {
          status: payload.status,
        },
      );
    });

    // TODO: Dispatch to developer webhooks: withdrawal.completed
  }

  private async handleWithdrawalReversed(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal reversed: ${payload.id}, reason: ${payload.reason}`,
    );

    await this.offrampRepo.manager.transaction(async (manager) => {
      await this.offrampRepo.update(
        { breet_reference: payload.id },
        {
          status: payload.status,
        },
      );

      // Update ledger entry
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        {
          status: payload.status,
          credit_ngn: parseFloat(payload.originalAmount),
          debit_ngn: 0,
        },
      );
    });

    // TODO: Dispatch to developer webhooks: withdrawal.reversed
  }

  private async handleWithdrawalRejected(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal rejected: ${payload.id}, reason: ${payload.reason}`,
    );

    await this.offrampRepo.manager.transaction(async (manager) => {
      await this.offrampRepo.update(
        { breet_reference: payload.id },
        {
          status: payload.status,
        },
      );

      // Update ledger entry
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        {
          status: payload.status,
          credit_ngn: parseFloat(payload.originalAmount),
          debit_ngn: 0,
        },
      );
    });

    // TODO: Dispatch to developer webhooks: withdrawal.rejected
  }

  private extractClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      ''
    );
  }
}
