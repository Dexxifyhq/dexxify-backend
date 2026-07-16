import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Request } from 'express';
import {
  PaymentSession,
  PaymentSessionStatus,
  Payout,
  PayoutStatus,
  LedgerEntry,
  TxType,
  LedgerEntryStatus,
  LedgerCurrency,
  Invoice,
  InvoiceStatus,
  Wallet,
  WalletAsset,
  WalletNetwork,
  SwapRecord,
  SwapRecordStatus,
  SwapRecordType,
  CryptoTransaction,
  CryptoTxDirection,
  CryptoTxStatus,
} from '../../database/entities';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { PlatformContextService } from '../platform/platform-context.service';

export enum CCWebhookEvent {
  // Payment session events
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_PARTIAL = 'payment.partial',
  PAYMENT_EXPIRED = 'payment.expired',
  PAYMENT_UNDERPAID = 'payment.underpaid',
  // Transaction events (fired per blockchain tx inside a session)
  TRANSACTION_RECEIVED = 'transaction.received',
  TRANSACTION_CONFIRMED = 'transaction.confirmed',
  // Invoice events
  INVOICE_CREATED = 'invoice.created',
  INVOICE_UPDATED = 'invoice.updated',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_EXPIRED = 'invoice.expired',
  // Payout events
  PAYOUT_CREATED = 'payout.created',
  PAYOUT_SUCCESS = 'payout.success',
  PAYOUT_FAILED = 'payout.failed',
  // Refund events
  REFUND_CREATED = 'refund.created',
  REFUND_SUCCESS = 'refund.success',
  REFUND_FAILED = 'refund.failed',
  // Swap events
  SWAP_COMPLETED = 'swap.completed',
  SWAP_FAILED = 'swap.failed',
  // Deposit account events
  DEPOSIT_PROCESSING = 'deposit.processing',
  DEPOSIT_COMPLETED = 'deposit.completed',
  DEPOSIT_FAILED = 'deposit.failed',
}

@Injectable()
export class CoincircuitWebhooksService {
  private readonly logger = new Logger(CoincircuitWebhooksService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly cc: CoincircuitService,
    private readonly platformCtx: PlatformContextService,
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(SwapRecord)
    private readonly swapRecordRepo: Repository<SwapRecord>,
    @InjectRepository(CryptoTransaction)
    private readonly cryptoTxRepo: Repository<CryptoTransaction>,
  ) {
    this.webhookSecret =
      this.config.get<string>('coincircuit.webhookSecret') || '';
  }

  verifyWebhookRequest(req: Request): { isValid: boolean; error?: string } {
    const signature = req.headers['x-coincircuit-signature'] as string;
    const timestamp = req.headers['x-coincircuit-timestamp'] as string;

    if (!signature || !timestamp || !this.webhookSecret) {
      this.logger.warn('Missing webhook signature, timestamp, or secret');
      return { isValid: false, error: 'Missing signature or timestamp' };
    }

    const rawBody: string =
      (req as any).rawBody ?? JSON.stringify((req as any).body ?? {});

    // Signed payload = "<timestamp>.<rawBody>"
    const signedPayload = `${timestamp}.${rawBody}`;

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // Signature header format: "v1=<hex>" — strip the version prefix
    const received = signature.replace(/^v1=/, '');

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(received, 'hex'),
        Buffer.from(expected, 'hex'),
      );

      if (!isValid) {
        this.logger.warn('CoincircuitMCP webhook signature mismatch');
        return { isValid: false, error: 'Invalid signature' };
      }
    } catch {
      return { isValid: false, error: 'Invalid signature' };
    }

    return { isValid: true };
  }

  async processWebhook(payload: any): Promise<void> {
    const event: string = payload.event;
    this.logger.log(`Processing CC webhook: ${event}`);

    switch (event) {
      // ── Payment session ──────────────────────────────
      case CCWebhookEvent.TRANSACTION_RECEIVED:
        await this.handleTransactionReceived(payload.data);
        break;
      case CCWebhookEvent.TRANSACTION_CONFIRMED:
        await this.handleTransactionConfirmed(payload.data);
        break;
      case CCWebhookEvent.PAYMENT_COMPLETED:
        await this.handlePaymentCompleted(payload.data);
        break;
      case CCWebhookEvent.PAYMENT_PARTIAL:
      case CCWebhookEvent.PAYMENT_UNDERPAID:
        await this.handlePaymentPartial(payload.data);
        break;
      case CCWebhookEvent.PAYMENT_EXPIRED:
        await this.handlePaymentExpired(payload.data);
        break;

      // ── Invoice ──────────────────────────────────────
      case CCWebhookEvent.INVOICE_CREATED:
        // no-op — we created it locally before syncing to CC
        break;
      case CCWebhookEvent.INVOICE_UPDATED:
        await this.handleInvoiceUpdated(payload.data);
        break;
      case CCWebhookEvent.INVOICE_PAID:
        await this.handleInvoicePaid(payload.data);
        break;
      case CCWebhookEvent.INVOICE_EXPIRED:
        await this.handleInvoiceExpired(payload.data);
        break;

      // ── Payout ───────────────────────────────────────
      case CCWebhookEvent.PAYOUT_CREATED:
        // no-op — payout already tracked locally
        break;
      case CCWebhookEvent.PAYOUT_SUCCESS:
        await this.handlePayoutSuccess(payload.data);
        break;
      case CCWebhookEvent.PAYOUT_FAILED:
        await this.handlePayoutFailed(payload.data);
        break;

      // ── Refund ───────────────────────────────────────
      case CCWebhookEvent.REFUND_CREATED:
        this.logger.log(`Refund initiated: ${payload.data?.refund?.id}`);
        break;
      case CCWebhookEvent.REFUND_SUCCESS:
        await this.handleRefundSuccess(payload.data);
        break;
      case CCWebhookEvent.REFUND_FAILED:
        this.logger.warn(`Refund failed: ${payload.data?.refund?.id}`);
        break;

      // ── Swap ─────────────────────────────────────────
      case CCWebhookEvent.SWAP_COMPLETED:
        await this.handleSwapCompleted(payload.data);
        break;
      case CCWebhookEvent.SWAP_FAILED:
        await this.handleSwapFailed(payload.data);
        break;

      // ── Deposit account ──────────────────────────────
      case CCWebhookEvent.DEPOSIT_PROCESSING:
        await this.handleDepositProcessing(payload.data);
        break;
      case CCWebhookEvent.DEPOSIT_COMPLETED:
        await this.handleDepositCompleted(payload.data);
        break;
      case CCWebhookEvent.DEPOSIT_FAILED:
        await this.handleDepositFailed(payload.data);
        break;

      default:
        this.logger.warn(`Unknown CC event: ${event}`);
    }
  }

  // ── Payment session handlers ──────────────────────────

  private async handleTransactionReceived(data: any): Promise<void> {
    // data = { session: PaymentWebhookDataDto, transaction: { id, txHash, chain, asset, amount, ... } }
    const ref = data.session?.reference;
    const tx = data.transaction;
    if (!ref) return;

    await this.dataSource.transaction(async (em) => {
      const session = await em
        .getRepository(PaymentSession)
        .findOne({ where: { provider_session_reference: ref } });
      if (!session) return;

      session.status = PaymentSessionStatus.PENDING;
      session.transaction_id = tx?.txHash ?? null;
      await em.getRepository(PaymentSession).save(session);

      if (!tx?.id) return;

      // Idempotent — skip if we already have a record for this CC transaction
      const existing = await em
        .getRepository(CryptoTransaction)
        .findOne({ where: { cc_transaction_id: tx.id } });
      if (existing) return;

      await em.getRepository(CryptoTransaction).save(
        em.getRepository(CryptoTransaction).create({
          developer_id: session.developer_id,
          direction: CryptoTxDirection.INBOUND,
          cc_transaction_id: tx.id,
          tx_hash: tx.txHash ?? null,
          crypto_asset: this.toCryptoAsset(tx.asset),
          network: this.toCryptoNetwork(tx.chain),
          crypto_amount: tx.amount != null ? Number(tx.amount) : null,
          wallet_address: tx.toAddress ?? null,
          fiat_currency: session.currency,
          status: CryptoTxStatus.PENDING,
          reference: session.reference,
          provider_reference: ref,
          description: `Inbound crypto for session ${ref}`,
          metadata: {
            sessionId: tx.sessionId,
            fromAddress: tx.fromAddress,
            amlCheck: tx.amlCheck,
            explorerUrl: tx.explorerUrl,
          },
        }),
      );
    });
  }

  private async handleTransactionConfirmed(data: any): Promise<void> {
    // data = { session: PaymentWebhookDataDto, transaction: { id, txHash, ... } }
    const tx = data.transaction;
    if (!tx?.id) return;

    await this.cryptoTxRepo.update(
      { cc_transaction_id: tx.id },
      { status: CryptoTxStatus.PROCESSING, tx_hash: tx.txHash ?? undefined },
    );
  }

  private async handlePaymentCompleted(data: any): Promise<void> {
    // data = PaymentWebhookDataDto: { reference, settlements, asset, ... }
    const ref = data.reference;
    if (!ref) return;

    const settlements = data.settlements;
    const netAmount = settlements?.net?.amount
      ? Number(settlements.net.amount)
      : null;
    const settlementCurrency: string =
      settlements?.currency ?? data.currency ?? 'NGN';

    await this.dataSource.transaction(async (em) => {
      const session = await em
        .getRepository(PaymentSession)
        .findOne({ where: { provider_session_reference: ref } });
      if (!session) return;

      const creditAmount = netAmount ?? Number(session.amount);

      session.status = PaymentSessionStatus.COMPLETED;
      session.completed_at = new Date();
      await em.getRepository(PaymentSession).save(session);

      // If this session was created to pay an invoice, mark it paid
      if (session.invoice_id) {
        await em.getRepository(Invoice).update(
          { id: session.invoice_id },
          { status: InvoiceStatus.PAID, paid_at: new Date() },
        );
      }

      // Mark the CryptoTransaction completed and fill in settlement amounts
      await em.getRepository(CryptoTransaction).update(
        { provider_reference: ref, direction: CryptoTxDirection.INBOUND },
        {
          status: CryptoTxStatus.COMPLETED,
          completed_at: new Date(),
          fiat_amount: creditAmount,
          fiat_currency: settlementCurrency,
        },
      );

      // Credit developer ledger
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          developer_id: session.developer_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'payment_session',
          reference_id: session.id,
          currency: settlementCurrency === 'NGN' ? LedgerCurrency.NGN : LedgerCurrency.USD,
          credit_ngn: settlementCurrency === 'NGN' ? creditAmount : 0,
          credit_usd: settlementCurrency === 'USD' ? creditAmount : 0,
          debit_ngn: 0,
          asset: session.crypto_asset ?? 'USDT',
          status: LedgerEntryStatus.COMPLETED,
          description: `Payment received for session ${session.id}`,
        }),
      );
    });
  }

  private async handlePaymentPartial(data: any): Promise<void> {
    const ref = data.reference ?? data.session?.reference;
    if (!ref) return;

    await this.sessionRepo.update(
      { provider_session_reference: ref },
      { status: PaymentSessionStatus.PENDING },
    );
  }

  private async handlePaymentExpired(data: any): Promise<void> {
    const ref = data.reference ?? data.session?.reference;
    if (!ref) return;

    await this.sessionRepo.update(
      { provider_session_reference: ref },
      { status: PaymentSessionStatus.EXPIRED },
    );
  }

  // ── Invoice handlers ─────────────────────────────────

  private async handleInvoiceUpdated(data: any): Promise<void> {
    const ccRef = data.invoice?.reference;
    if (!ccRef) return;

    const ccStatus: string = data.invoice?.status;
    if (!ccStatus) return;

    // Only sync status transitions that map to a meaningful local state
    const statusMap: Partial<Record<string, InvoiceStatus>> = {
      paid: InvoiceStatus.PAID,
      expired: InvoiceStatus.OVERDUE,
    };

    const localStatus = statusMap[ccStatus];
    if (!localStatus) return;

    const invoice = await this.invoiceRepo.findOne({
      where: { provider_invoice_reference: ccRef },
    });
    if (!invoice) return;

    invoice.status = localStatus;
    if (localStatus === InvoiceStatus.PAID && !invoice.paid_at) {
      invoice.paid_at = data.invoice.paidAt
        ? new Date(data.invoice.paidAt)
        : new Date();
    }
    await this.invoiceRepo.save(invoice);
  }

  private async handleInvoicePaid(data: any): Promise<void> {
    const ccRef = data.invoice?.reference;
    if (!ccRef) return;

    const invoice = await this.invoiceRepo.findOne({
      where: { provider_invoice_reference: ccRef },
    });
    if (!invoice) return;

    invoice.status = InvoiceStatus.PAID;
    invoice.paid_at = data.invoice.paidAt
      ? new Date(data.invoice.paidAt)
      : new Date();
    await this.invoiceRepo.save(invoice);

    const amountPaid = Number(
      data.invoice?.amountPaid ?? data.invoice?.amount ?? invoice.total,
    );
    const currency: string = data.invoice?.currency ?? invoice.currency;

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: invoice.developer_id,
        tx_type: TxType.DEPOSIT,
        reference_type: 'invoice',
        reference_id: invoice.id,
        currency: currency === 'NGN' ? LedgerCurrency.NGN : LedgerCurrency.USD,
        credit_ngn: currency === 'NGN' ? amountPaid : 0,
        credit_usd: currency === 'USD' ? amountPaid : 0,
        debit_ngn: 0,
        asset: data.invoice?.asset ?? 'USDT',
        status: LedgerEntryStatus.COMPLETED,
        description: `Invoice ${invoice.invoice_number} paid`,
      }),
    );
  }

  private async handleInvoiceExpired(data: any): Promise<void> {
    const ccRef = data.invoice?.reference;
    if (!ccRef) return;

    await this.invoiceRepo.update(
      { provider_invoice_reference: ccRef },
      { status: InvoiceStatus.OVERDUE },
    );
  }

  // ── Payout handlers ──────────────────────────────────

  private async handlePayoutSuccess(data: any): Promise<void> {
    const ref = data.payout?.id ?? data.payout?.reference;
    if (!ref) return;

    await this.payoutRepo.update(
      { provider_payout_id: ref },
      { status: PayoutStatus.COMPLETED, completed_at: new Date() },
    );

    const payout = await this.payoutRepo.findOne({
      where: { provider_payout_id: ref },
    });
    if (!payout) return;

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: payout.developer_id,
        tx_type: TxType.PAYOUT,
        reference_type: 'payout',
        reference_id: payout.id,
        currency: LedgerCurrency.NGN,
        debit_ngn: Number(payout.amount),
        credit_ngn: 0,
        asset: 'NGN',
        status: LedgerEntryStatus.COMPLETED,
        description: `Payout to ${payout.account_number}`,
      }),
    );
  }

  private async handlePayoutFailed(data: any): Promise<void> {
    const ref = data.payout?.id ?? data.payout?.reference;
    if (!ref) return;

    await this.payoutRepo.update(
      { provider_payout_id: ref },
      {
        status: PayoutStatus.FAILED,
        failure_reason: data.payout?.failureReason ?? 'Unknown',
      },
    );
  }

  // ── Refund handlers ──────────────────────────────────

  private async handleRefundSuccess(data: any): Promise<void> {
    const refund = data.refund;
    if (!refund) return;

    // Resolve developer_id from the entity the refund belongs to
    let developerId: string | null = null;

    if (refund.entity === 'session') {
      const session = await this.sessionRepo.findOne({
        where: { provider_session_reference: refund.reference },
        select: ['developer_id'],
      });
      developerId = session?.developer_id ?? null;
    } else if (refund.entity === 'invoice') {
      const invoice = await this.invoiceRepo.findOne({
        where: { provider_invoice_reference: refund.reference },
        select: ['developer_id'],
      });
      developerId = invoice?.developer_id ?? null;
    }

    if (!developerId) {
      this.logger.warn(
        `refund.success: no local record found for ${refund.entity} ref=${refund.reference}`,
      );
      return;
    }

    const debitAmount = Number(
      refund.merchantDebitAmount ?? refund.fiatAmount ?? 0,
    );
    const currency: string = refund.fiatCurrency ?? 'NGN';

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: developerId,
        tx_type: TxType.REFUND,
        reference_type: refund.entity,
        reference_id: refund.id,
        currency: currency === 'NGN' ? LedgerCurrency.NGN : LedgerCurrency.USD,
        debit_ngn: currency === 'NGN' ? debitAmount : 0,
        debit_usd: currency === 'USD' ? debitAmount : 0,
        credit_ngn: 0,
        asset: refund.asset ?? 'USDT',
        status: LedgerEntryStatus.COMPLETED,
        description: `Refund for ${refund.entity} ${refund.reference}`,
        metadata: {
          txHash: refund.txHash,
          refundAddress: refund.refundAddress,
        },
      }),
    );
  }

  // ── Swap handlers ────────────────────────────────────

  private async handleSwapCompleted(data: any): Promise<void> {
    const swap = data.swap;
    if (!swap?.id) return;

    const record = await this.swapRecordRepo.findOne({
      where: { cc_swap_id: swap.id },
    });

    if (!record) {
      this.logger.warn(`swap.completed: no local record for swap ${swap.id}`);
      return;
    }

    const sourceAmount = Number(swap.sourceAmount);
    const targetAmount = Number(swap.targetAmount);
    const fromCurrency: string = swap.fromCurrency;
    const toCurrency: string = swap.toCurrency;

    await this.swapRecordRepo.update(
      { cc_swap_id: swap.id },
      { status: SwapRecordStatus.COMPLETED, target_amount: targetAmount },
    );

    // Swap ledger entry — debit source, credit target (applies to all swap types)
    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: record.developer_id,
        tx_type: TxType.SWAP,
        reference_type: 'swap',
        reference_id: record.id,
        currency: toCurrency === 'NGN' ? LedgerCurrency.NGN : LedgerCurrency.USD,
        debit_ngn: fromCurrency === 'NGN' ? sourceAmount : 0,
        debit_usd: fromCurrency === 'USDT' ? sourceAmount : 0,
        credit_ngn: toCurrency === 'NGN' ? targetAmount : 0,
        credit_usd: toCurrency === 'USDT' ? targetAmount : 0,
        asset: fromCurrency,
        status: LedgerEntryStatus.COMPLETED,
        description: `Swap ${sourceAmount} ${fromCurrency} → ${targetAmount} ${toCurrency} @ ${swap.rate}`,
        metadata: { quotationId: swap.quotation?.id, rate: swap.rate },
      }),
    );

    // OFFRAMP: auto-trigger NGN payout to the developer's bank
    if (record.type === SwapRecordType.OFFRAMP) {
      await this.triggerOfframpPayout(record, targetAmount);
    }
  }

  private async triggerOfframpPayout(
    record: SwapRecord,
    grossNgn: number,
  ): Promise<void> {
    const meta = record.metadata as { recipientId: string; feePercent: number };
    const feeNgn = grossNgn * ((meta.feePercent ?? 1.5) / 100);
    const netNgn = grossNgn - feeNgn;

    // Fee debit from developer + matching credit to platform (double-entry)
    const platformId = this.platformCtx.getDeveloperId();
    await this.ledgerRepo.save([
      this.ledgerRepo.create({
        developer_id: record.developer_id,
        tx_type: TxType.FEE,
        reference_type: 'swap',
        reference_id: record.id,
        currency: LedgerCurrency.NGN,
        debit_ngn: feeNgn,
        credit_ngn: 0,
        asset: 'NGN',
        status: LedgerEntryStatus.COMPLETED,
        description: `Offramp fee (${meta.feePercent ?? 1.5}%)`,
      }),
      this.ledgerRepo.create({
        developer_id: platformId,
        tx_type: TxType.FEE,
        reference_type: 'swap',
        reference_id: record.id,
        currency: LedgerCurrency.NGN,
        credit_ngn: feeNgn,
        debit_ngn: 0,
        asset: 'NGN',
        status: LedgerEntryStatus.COMPLETED,
        description: `Fee income: offramp (${meta.feePercent ?? 1.5}%)`,
      }),
    ]);

    // Initiate CC payout of net NGN to developer's bank
    let payoutData: any;
    try {
      const result = await this.cc.initiatePayout({
        recipientId: meta.recipientId,
        amount: netNgn.toFixed(2),
        currency: 'NGN',
        narration: 'Offramp payout',
      });
      payoutData = result.data;
    } catch (err) {
      this.logger.error(
        `Offramp payout failed for swap ${record.cc_swap_id}: ${err.message}`,
      );
      return;
    }

    // Save Payout record — payout.success webhook writes the debit ledger entry
    await this.payoutRepo.save(
      this.payoutRepo.create({
        developer_id: record.developer_id,
        amount: netNgn,
        fee: feeNgn,
        bank_code: null,
        account_number: null,
        narration: 'Offramp payout',
        status: PayoutStatus.PENDING,
        provider_payout_id: payoutData.id,
        metadata: { swapRecordId: record.id, recipientId: meta.recipientId },
      }),
    );

    this.logger.log(
      `Offramp payout ${payoutData.id} initiated: ₦${netNgn.toFixed(2)} (fee ₦${feeNgn.toFixed(2)})`,
    );
  }

  private async handleSwapFailed(data: any): Promise<void> {
    const swap = data.swap;
    if (!swap?.id) return;

    await this.swapRecordRepo.update(
      { cc_swap_id: swap.id },
      { status: SwapRecordStatus.FAILED },
    );

    this.logger.warn(
      `Swap failed: ${swap.id} (${swap.fromCurrency} → ${swap.toCurrency})`,
    );
  }

  // ── Deposit account handlers ─────────────────────────

  private async handleDepositProcessing(data: any): Promise<void> {
    // Blockchain tx detected but not yet confirmed — nothing to credit yet
    this.logger.log(
      `Deposit processing: ${data.id} — ${data.amount} ${data.currency} (${data.type})`,
    );
  }

  private async handleDepositCompleted(data: any): Promise<void> {
    if (!data.depositAccountId) {
      this.logger.warn(
        `deposit.completed: missing depositAccountId in payload`,
      );
      return;
    }

    // Wallet.id === CC deposit account ID
    const wallet = await this.walletRepo.findOne({
      where: { id: data.depositAccountId },
      select: ['id', 'developer_id'],
    });

    if (!wallet) {
      this.logger.warn(
        `deposit.completed: no wallet found for account ${data.depositAccountId}`,
      );
      return;
    }

    const netAmount = Number(data.netAmount);
    const currency: string = data.currency; // 'USDT' | 'NGN' | ...
    const asset: string = data.crypto?.asset ?? currency;

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: wallet.developer_id,
        tx_type: TxType.DEPOSIT,
        reference_type: 'deposit',
        reference_id: data.id,
        wallet_address: data.depositAccountId,
        currency: currency === 'NGN' ? LedgerCurrency.NGN : LedgerCurrency.USD,
        credit_ngn: currency === 'NGN' ? netAmount : 0,
        credit_usd: currency === 'USDT' ? netAmount : 0,
        debit_ngn: 0,
        asset,
        status: LedgerEntryStatus.COMPLETED,
        description: `${data.type === 'crypto' ? 'Crypto' : 'Bank'} deposit: ${data.amount} ${currency}`,
        metadata: {
          depositId: data.id,
          txHash: data.crypto?.txHash ?? null,
          chain: data.crypto?.chain ?? null,
          customerId: data.customer?.id ?? null,
        },
      }),
    );
  }

  private async handleDepositFailed(data: any): Promise<void> {
    this.logger.warn(
      `Deposit failed (compliance): ${data.id} — ${data.amount} ${data.currency}`,
    );

    if (!data.depositAccountId) return;

    const wallet = await this.walletRepo.findOne({
      where: { id: data.depositAccountId },
      select: ['developer_id'],
    });
    if (!wallet) return;

    // Record a rejected entry for audit trail
    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        developer_id: wallet.developer_id,
        tx_type: TxType.DEPOSIT,
        reference_type: 'deposit',
        reference_id: data.id,
        wallet_address: data.depositAccountId,
        currency: data.currency === 'NGN' ? LedgerCurrency.NGN : LedgerCurrency.USD,
        credit_ngn: 0,
        debit_ngn: 0,
        asset: data.crypto?.asset ?? data.currency,
        status: LedgerEntryStatus.REJECTED,
        description: `Failed deposit: ${data.amount} ${data.currency}`,
        metadata: { txHash: data.crypto?.txHash ?? null },
      }),
    );
  }

  // ── Enum mapping helpers ─────────────────────────────

  private toCryptoAsset(ccAsset?: string): WalletAsset | null {
    if (!ccAsset) return null;
    const map: Record<string, WalletAsset> = {
      BTC: WalletAsset.BTC,
      ETH: WalletAsset.ETH,
      USDT: WalletAsset.USDT,
      USDC: WalletAsset.USDC,
      SOL: WalletAsset.SOL,
      BNB: WalletAsset.BNB,
      TRX: WalletAsset.TRX,
      TON: WalletAsset.TON,
    };
    return map[ccAsset.toUpperCase()] ?? null;
  }

  private toCryptoNetwork(ccChain?: string): WalletNetwork | null {
    if (!ccChain) return null;
    const map: Record<string, WalletNetwork> = {
      bitcoin: WalletNetwork.BITCOIN,
      ethereum: WalletNetwork.ETHEREUM,
      solana: WalletNetwork.SOLANA,
      bsc: WalletNetwork.BINANCE_SMART_CHAIN,
      tron: WalletNetwork.TRON,
      base: WalletNetwork.BASE,
      arbitrum: WalletNetwork.ARBITRUM,
      ton: WalletNetwork.TON,
    };
    return map[ccChain.toLowerCase()] ?? null;
  }
}
