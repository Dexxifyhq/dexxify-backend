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
} from '../../database/entities';

export enum BreetWebhookEventType {
  TRADE_PENDING = 'trade.pending',
  TRADE_COMPLETED = 'trade.completed',
  TRADE_FLAGGED = 'trade.flagged',
  WITHDRAWAL_PENDING = 'withdrawal.pending',
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
  ) {
    this.webhookSecret = this.config.get<string>('breet.webhookSecret') || '';
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

  private async handleTradePending(payload: any): Promise<void> {
    this.logger.log(
      `Trade pending detected: ${payload.id}, asset: ${payload.asset}`,
    );
    // TODO: Create/Update ledger entry as pending
    const ledgerEntry = await this.ledgerRepo.findOne({
      where: { reference_id: payload.id },
    });

    const developerWallet = await this.walletRepo.findOne({
      where: { deposit_address: payload.destinationAddress },
    });

    if (!developerWallet) {
      throw new NotFoundException('Developer wallet not found');
    }

    if (ledgerEntry) {
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        { status: LedgerEntryStatus.PENDING },
      );
    }

    if (!ledgerEntry) {
      // Create new ledger entry
      await this.ledgerRepo.save(
        this.ledgerRepo.create({
          developer_id: developerWallet.developer_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'breet_trade',
          reference_id: payload.id,
          debit: 0,
          amount_usd: payload.amountInUSD,
          credit: parseFloat(payload.cryptoAmount),
          wallet_address: payload.destinationAddress,
          asset: payload.asset,
          status: LedgerEntryStatus.PENDING,
          description: `Breet trade pending: ${payload.id}`,
          metadata: {
            ...payload,
          },
        }),
      );
    }

    // TODO: Dispatch to developer webhooks: wallet.deposit.pending
  }

  private async handleTradeCompleted(payload: any): Promise<void> {
    this.logger.log(
      `Trade completed: ${payload.id}, amount: ${payload.amountInUSD} USD`,
    );
    // TODO: Credit wallet balance
    const ledgerEntry = await this.ledgerRepo.findOne({
      where: { reference_id: payload.id },
    });

    if (ledgerEntry) {
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        { status: LedgerEntryStatus.COMPLETED, metadata: { ...payload } },
      );
    }
    // TODO: Dispatch to developer webhooks: wallet.deposit.completed
  }

  private async handleTradeFlagged(payload: any): Promise<void> {
    this.logger.log(
      `Trade flagged: ${payload.id}, amount: ${payload.amountInUSD} USD`,
    );
    // TODO: Mark as flagged in ledger
    const ledgerEntry = await this.ledgerRepo.findOne({
      where: { reference_id: payload.id },
    });

    const developerWallet = await this.walletRepo.findOne({
      where: { deposit_address: payload.destinationAddress },
    });

    if (!developerWallet) {
      throw new NotFoundException('Developer wallet not found');
    }

    if (ledgerEntry) {
      await this.ledgerRepo.update(
        { reference_id: payload.id },
        { status: LedgerEntryStatus.FLAGGED, metadata: { ...payload } },
      );
    }

    if (!ledgerEntry) {
      // Create new ledger entry
      await this.ledgerRepo.save(
        this.ledgerRepo.create({
          developer_id: developerWallet.developer_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'breet_trade',
          reference_id: payload.id,
          debit: 0,
          amount_usd: payload.amountInUSD,
          credit: parseFloat(payload.cryptoAmount),
          wallet_address: payload.destinationAddress,
          asset: payload.asset,
          status: LedgerEntryStatus.FLAGGED,
          description: `Breet trade flagged: ${payload.id}`,
          metadata: {
            ...payload,
          },
        }),
      );
    }

    // TODO: Dispatch to developer webhooks: wallet.deposit.flagged
  }

  private async handleWithdrawalPending(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal pending: ${payload.id}, amount: ${payload.amount}`,
    );
    // TODO: Update withdrawal status to pending
    // TODO: Dispatch to developer webhooks: withdrawal.pending
  }

  private async handleWithdrawalCompleted(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal completed: ${payload.id}, txHash: ${payload.txHash}`,
    );
    // TODO: Update withdrawal status to completed
    // TODO: Dispatch to developer webhooks: withdrawal.completed
  }

  private async handleWithdrawalReversed(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal reversed: ${payload.id}, reason: ${payload.reason}`,
    );
    // TODO: Refund wallet balance
    // TODO: Update withdrawal status to reversed
    // TODO: Dispatch to developer webhooks: withdrawal.reversed
  }

  private async handleWithdrawalRejected(payload: any): Promise<void> {
    this.logger.log(
      `Withdrawal rejected: ${payload.id}, reason: ${payload.reason}`,
    );
    // TODO: Refund wallet balance
    // TODO: Update withdrawal status to rejected
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
