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
  DepositAccount,
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
import { WebhooksService } from './webhooks.service';

export enum CCWebhookEvent {
  // Payment session events
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_PARTIAL = 'payment.partial',
  PAYMENT_EXPIRED = 'payment.expired',
  PAYMENT_UNDERPAID = 'payment.underpaid',
  PAYMENT_FAILED = 'payment.failed',
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

// ── Coincircuit webhook payload shapes ──────────────────────

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

interface CCWebhookTransaction {
  id?: string;
  txHash?: string;
  chain?: string;
  asset?: string;
  amount?: string | number;
  toAddress?: string;
  fromAddress?: string;
  confirmations?: number;
  amlCheck?: string;
  explorerUrl?: string;
}

interface CCWebhookPaymentSession {
  id?: string;
  reference?: string;
  state?: string;
  amount?: string | number;
  amountPaid?: string | number;
  currency?: string;
  fiatAmountPaid?: string | number;
  settlements?: {
    currency?: string;
    customerPaid?: {
      amount?: string | number;
    };
    gross?: {
      amount?: string | number;
      conversionRate?: string | number;
    };
    fees?: {
      processing?: {
        amount?: string | number;
        paidBy?: string;
      };
      gas?: {
        amount?: string | number;
        paidBy?: string;
      };
    };
    net?: { amount?: string | number };
  };
  payment: {
    status?: string;
    asset?: string;
    chain?: string;
    amount?: string | number;
    amountReceived?: string | number;
    address?: string;
    conversionRate?: string | number;
    gasFee?: string | number;
    feePaidBy?: string;
    txHash?: string | null;
  };
}

interface CCWebhookInvoice {
  reference?: string;
  status?: string;
  paidAt?: string;
  amount?: string | number;
  amountPaid?: string | number;
  currency?: string;
}

interface CCWebhookPayout {
  id?: string;
  reference?: string;
  failureReason?: string;
}

interface CCWebhookRefund {
  id?: string;
  entity?: 'session' | 'invoice';
  reference?: string;
  merchantDebitAmount?: string | number;
  amount?: string | number;
  fiatAmount?: string | number;
  fiatCurrency?: string;
  asset?: string;
  chain?: string;
  txHash?: string;
  refundAddress?: string;
}

interface CCWebhookSwap {
  id?: string;
  sourceAmount?: string | number;
  targetAmount?: string | number;
  fromCurrency: string;
  toCurrency: string;
  rate?: string | number;
  quotation?: { id?: string };
}

interface CCWebhookDepositCrypto {
  asset?: string;
  chain?: string;
  amount?: string | number;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
}

interface CCWebhookDepositFiat {
  payer?: {
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    bankCode?: string;
  };
  payee?: {
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    bankCode?: string;
  };
  ngnVirtualAccount?: {
    accountNumber?: string;
    accountName?: string;
    accountReference?: string;
    currency?: string;
    bankName?: string;
    bankCode?: string;
    createdAt?: string;
  };
  method?: string;
  reference?: string;
}

interface CCWebhookDepositCustomer {
  id?: string;
  email?: string;
}

interface CCWebhookDeposit {
  id: string;
  depositAccountId?: string;
  amount: string | number;
  netAmount?: string | number;
  currency: string;
  type?: string;
  fee?: string | number;
  crypto?: CCWebhookDepositCrypto;
  fiat?: CCWebhookDepositFiat;
  customer?: CCWebhookDepositCustomer;
}

interface CCWebhookTransactionEventData {
  session?: CCWebhookPaymentSession;
  transaction?: CCWebhookTransaction;
}

interface CCWebhookPaymentEventData {
  session: CCWebhookPaymentSession;
}

interface CCWebhookPaymentFailedEventData {
  session: CCWebhookPaymentSession;
  failureReason: string;
}

interface CCWebhookInvoiceEventData {
  invoice?: CCWebhookInvoice;
}

interface CCWebhookPayoutEventData {
  payout?: CCWebhookPayout;
}

interface CCWebhookRefundEventData {
  refund?: CCWebhookRefund;
}

interface CCWebhookSwapEventData {
  swap?: CCWebhookSwap;
}

/** Discriminated union of all Coincircuit webhook payload shapes we handle */
export type CCWebhookPayload =
  | {
      event: CCWebhookEvent.TRANSACTION_RECEIVED;
      data: CCWebhookTransactionEventData;
    }
  | {
      event: CCWebhookEvent.TRANSACTION_CONFIRMED;
      data: CCWebhookTransactionEventData;
    }
  | { event: CCWebhookEvent.PAYMENT_COMPLETED; data: CCWebhookPaymentEventData }
  | { event: CCWebhookEvent.PAYMENT_PARTIAL; data: CCWebhookPaymentEventData }
  | { event: CCWebhookEvent.PAYMENT_UNDERPAID; data: CCWebhookPaymentEventData }
  | { event: CCWebhookEvent.PAYMENT_EXPIRED; data: CCWebhookPaymentEventData }
  | {
      event: CCWebhookEvent.PAYMENT_FAILED;
      data: CCWebhookPaymentFailedEventData;
    }
  | { event: CCWebhookEvent.INVOICE_CREATED; data: CCWebhookInvoiceEventData }
  | { event: CCWebhookEvent.INVOICE_UPDATED; data: CCWebhookInvoiceEventData }
  | { event: CCWebhookEvent.INVOICE_PAID; data: CCWebhookInvoiceEventData }
  | { event: CCWebhookEvent.INVOICE_EXPIRED; data: CCWebhookInvoiceEventData }
  | { event: CCWebhookEvent.PAYOUT_CREATED; data: CCWebhookPayoutEventData }
  | { event: CCWebhookEvent.PAYOUT_SUCCESS; data: CCWebhookPayoutEventData }
  | { event: CCWebhookEvent.PAYOUT_FAILED; data: CCWebhookPayoutEventData }
  | { event: CCWebhookEvent.REFUND_CREATED; data: CCWebhookRefundEventData }
  | { event: CCWebhookEvent.REFUND_SUCCESS; data: CCWebhookRefundEventData }
  | { event: CCWebhookEvent.REFUND_FAILED; data: CCWebhookRefundEventData }
  | { event: CCWebhookEvent.SWAP_COMPLETED; data: CCWebhookSwapEventData }
  | { event: CCWebhookEvent.SWAP_FAILED; data: CCWebhookSwapEventData }
  | { event: CCWebhookEvent.DEPOSIT_PROCESSING; data: CCWebhookDeposit }
  | { event: CCWebhookEvent.DEPOSIT_COMPLETED; data: CCWebhookDeposit }
  | { event: CCWebhookEvent.DEPOSIT_FAILED; data: CCWebhookDeposit };

interface CCPayoutResult {
  id?: string;
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
    private readonly webhooksService: WebhooksService,
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(DepositAccount)
    private readonly walletRepo: Repository<DepositAccount>,
    @InjectRepository(SwapRecord)
    private readonly swapRecordRepo: Repository<SwapRecord>,
    @InjectRepository(CryptoTransaction)
    private readonly cryptoTxRepo: Repository<CryptoTransaction>,
  ) {
    const isProd = this.config.get<string>('app.nodeEnv') === 'production';
    this.webhookSecret = isProd
      ? this.config.get<string>('coincircuit.webhookSecret') || ''
      : this.config.get<string>('coincircuit.testWebhookSecret') || '';
  }

  verifyWebhookRequest(req: RequestWithRawBody): {
    isValid: boolean;
    error?: string;
  } {
    const signature = req.headers['x-coincircuit-signature'] as string;
    const timestamp = req.headers['x-coincircuit-timestamp'] as string;
    // console.log('signature', signature);
    // console.log('timestamp', timestamp);

    if (!signature || !timestamp || !this.webhookSecret) {
      this.logger.warn('Missing webhook signature, timestamp, or secret');
      return { isValid: false, error: 'Missing signature or timestamp' };
    }

    const rawBody: string = req.rawBody ?? JSON.stringify(req.body ?? {});
    // console.log('Req.Body', req.body);
    // console.log('Req.RawBody', rawBody);

    // Signed payload = "<timestamp>.<rawBody>"
    // const signedPayload = `${timestamp}.${rawBody}`;
    const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;

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

  async processWebhook(payload: CCWebhookPayload): Promise<void> {
    // Captured before the switch narrows `payload` case-by-case, so it stays
    // usable (and typed) in the default branch below.
    const eventLabel = payload.event;
    this.logger.log(`Processing CC webhook: ${eventLabel}`);

    switch (payload.event) {
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
        // case CCWebhookEvent.PAYMENT_UNDERPAID:
        await this.handlePaymentPartial(payload.data);
        break;
      case CCWebhookEvent.PAYMENT_EXPIRED:
        await this.handlePaymentExpired(payload.data);
        break;
      case CCWebhookEvent.PAYMENT_FAILED:
        await this.handlePaymentFailed(payload.data);
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
        await this.handlePayoutCreated(payload.data);
        break;
      case CCWebhookEvent.PAYOUT_SUCCESS:
        await this.handlePayoutSuccess(payload.data);
        break;
      case CCWebhookEvent.PAYOUT_FAILED:
        await this.handlePayoutFailed(payload.data);
        break;

      // ── Refund ───────────────────────────────────────
      case CCWebhookEvent.REFUND_CREATED:
        await this.handleRefundCreated(payload.data);
        break;
      case CCWebhookEvent.REFUND_SUCCESS:
        await this.handleRefundSuccess(payload.data);
        break;
      case CCWebhookEvent.REFUND_FAILED:
        await this.handleRefundFailed(payload.data);
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
        this.logger.warn(`Unknown CC event: ${eventLabel}`);
    }
  }

  // ── Payment session handlers ──────────────────────────

  private async handleTransactionReceived(
    data: CCWebhookTransactionEventData,
  ): Promise<void> {
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

      void this.webhooksService.dispatch(
        session.business_id,
        'transaction.received',
        {
          sessionReference: ref,
          txHash: tx?.txHash ?? null,
          asset: tx?.asset ?? null,
          chain: tx?.chain ?? null,
          amount: tx?.amount ?? null,
        },
      );

      if (!tx?.id) return;

      // Idempotent — skip if we already have a record for this CC transaction
      const existing = await em
        .getRepository(CryptoTransaction)
        .findOne({ where: { cc_transaction_id: tx.id } });
      if (existing) return;

      // const currency =
      //   tx.asset === 'USDC' ? LedgerCurrency.USDC : LedgerCurrency.USDT;

      await em.getRepository(CryptoTransaction).save(
        em.getRepository(CryptoTransaction).create({
          business_id: session.business_id,
          direction: CryptoTxDirection.INBOUND,
          cc_transaction_id: tx.id,
          tx_hash: tx.txHash ?? null,
          crypto_asset: this.toCryptoAsset(tx.asset),
          network: this.toCryptoNetwork(tx.chain),
          amount: tx.amount != null ? Number(tx.amount) : null,
          from_address: tx.fromAddress ?? null,
          to_address: tx.toAddress ?? null,
          currency: LedgerCurrency.USDT,
          status: CryptoTxStatus.PENDING,
          provider_reference: ref,
          mode: session.mode,
          description: `Inbound crypto for session ${ref}`,
          metadata: {
            sessionId: data.session?.id,
            confirmations: tx.confirmations,
            amlCheck: tx.amlCheck,
            explorerUrl: tx.explorerUrl,
          },
        }),
      );
    });
  }

  private async handleTransactionConfirmed(
    data: CCWebhookTransactionEventData,
  ): Promise<void> {
    const tx = data.transaction;
    if (!tx?.id) return;

    const transaction = await this.cryptoTxRepo.findOne({
      where: { cc_transaction_id: tx.id },
    });
    if (!transaction) return;

    const metadata = {
      sessionId: data.session?.id,
      confirmations: tx.confirmations,
      amlCheck: tx.amlCheck,
      explorerUrl: tx.explorerUrl,
    };

    await this.cryptoTxRepo.update(
      { id: transaction.id },
      {
        status: CryptoTxStatus.CONFIRMED,
        tx_hash: tx.txHash ?? undefined,
        metadata: {
          ...transaction.metadata,
          ...metadata,
        } as Record<string, any>,
      },
    );

    void this.webhooksService.dispatch(
      transaction.business_id,
      'transaction.confirmed',
      {
        txHash: tx.txHash ?? transaction.tx_hash,
        confirmations: tx.confirmations ?? null,
        amount: transaction.amount,
      },
    );
  }

  private async handlePaymentCompleted(
    data: CCWebhookPaymentEventData,
  ): Promise<void> {
    const ref = data.session.reference;
    if (!ref) return;

    const session = data.session;
    const settlements = session.settlements;
    const payment = session.payment;
    const creditAmount = Number(session.amountPaid);
    const fee =
      Number(settlements?.fees?.processing?.amount ?? 0) +
      Number(settlements?.fees?.gas?.amount ?? 0);
    const netAmount = settlements?.net?.amount
      ? Number(settlements.net.amount)
      : null;
    // const settlementCurrency: string =
    //   payment.asset === LedgerCurrency.USDC
    //     ? LedgerCurrency.USDC
    //     : LedgerCurrency.USDT;

    await this.dataSource.transaction(async (em) => {
      const session = await em
        .getRepository(PaymentSession)
        .findOne({ where: { provider_session_reference: ref } });
      if (!session) return;

      session.status = PaymentSessionStatus.COMPLETED;
      session.completed_at = new Date();
      await em.getRepository(PaymentSession).save(session);

      // If this session was created to pay an invoice, mark it paid
      if (session.invoice_id) {
        await em
          .getRepository(Invoice)
          .update(
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
          amount: creditAmount,
          net_amount: netAmount,
          fee,
          currency: LedgerCurrency.USDT,
        },
      );

      // Dashboard settlerment currency is set to USDT
      const asset = payment.asset;
      const network = payment.chain;
      // const isNGN = settlementCurrency === 'NGN';
      // const isUSDT = settlementCurrency === 'USD';
      // const paymentCurrency = LedgerCurrency.USDT;

      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: session.business_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'payment_session',
          reference_id: session.id,
          currency: LedgerCurrency.USDT,
          asset,
          network,
          credit_usdt: netAmount ?? 0,
          // credit_usdt: settlementCurrency === 'USDT' ? creditAmount : 0,
          // credit_usdc: settlementCurrency === 'USDC' ? creditAmount : 0,
          status: LedgerEntryStatus.COMPLETED,
          mode: session.mode,
          description: `Payment received for session ${session.reference}`,
          metadata: session.metadata,
        }),
      );

      void this.webhooksService.dispatch(
        session.business_id,
        'payment.completed',
        {
          sessionReference: session.reference,
          amount: creditAmount,
          netAmount,
          asset,
          network,
        },
      );
    });
  }

  private async handlePaymentPartial(
    data: CCWebhookPaymentEventData,
  ): Promise<void> {
    const ref = data.session.reference;
    if (!ref) return;

    const session = data.session;
    const payment = session.payment;
    const fiatAmountPaid =
      session.fiatAmountPaid != null ? Number(session.fiatAmountPaid) : null;
    const cryptoAmountReceived =
      payment.amountReceived != null ? Number(payment.amountReceived) : null;

    await this.dataSource.transaction(async (em) => {
      const paymentSession = await em
        .getRepository(PaymentSession)
        .findOne({ where: { provider_session_reference: ref } });
      if (!paymentSession) return;

      paymentSession.status = PaymentSessionStatus.PARTIAL;
      paymentSession.metadata = {
        ...paymentSession.metadata,
        paymentStatus: payment.status,
        fiatAmountPaid,
        cryptoAmountReceived,
        expectedCryptoAmount:
          payment.amount != null ? Number(payment.amount) : null,
        expectedFiatAmount:
          session.amount != null ? Number(session.amount) : null,
        conversionRate: payment.conversionRate,
        gasFee: payment.gasFee,
        feePaidBy: payment.feePaidBy,
      } as Record<string, any>;
      await em.getRepository(PaymentSession).save(paymentSession);

      // Reflect the partial receipt on the inbound crypto transaction.
      // No ledger credit here — funds aren't settled until payment.completed fires.
      await em.getRepository(CryptoTransaction).update(
        { provider_reference: ref, direction: CryptoTxDirection.INBOUND },
        {
          status: CryptoTxStatus.PROCESSING,
          amount: fiatAmountPaid,
        },
      );

      void this.webhooksService.dispatch(
        paymentSession.business_id,
        'payment.partial',
        {
          sessionReference: ref,
          fiatAmountPaid,
          cryptoAmountReceived,
        },
      );
    });
  }

  private async handlePaymentExpired(
    data: CCWebhookPaymentEventData,
  ): Promise<void> {
    const ref = data.session.reference;
    if (!ref) return;

    const session = await this.sessionRepo.findOne({
      where: { provider_session_reference: ref },
      select: ['id', 'business_id'],
    });
    if (!session) return;

    await this.sessionRepo.update(session.id, {
      status: PaymentSessionStatus.EXPIRED,
    });

    void this.webhooksService.dispatch(session.business_id, 'payment.expired', {
      sessionReference: ref,
    });
  }

  /**
   * Fired when a session is rejected for compliance/AML reasons — funds may
   * already have arrived on-chain (per the payload), but the session itself
   * is being closed as failed, so nothing gets credited to the merchant.
   */
  private async handlePaymentFailed(
    data: CCWebhookPaymentFailedEventData,
  ): Promise<void> {
    const ref = data.session.reference;
    if (!ref) return;

    const payment = data.session.payment;
    const failureReason = data.failureReason;

    await this.dataSource.transaction(async (em) => {
      const session = await em
        .getRepository(PaymentSession)
        .findOne({ where: { provider_session_reference: ref } });
      if (!session) return;

      session.status = PaymentSessionStatus.FAILED;
      session.metadata = {
        ...session.metadata,
        failureReason,
        paymentStatus: payment.status,
      } as Record<string, any>;
      await em.getRepository(PaymentSession).save(session);

      // Funds may have arrived (amountReceived) but the session was rejected —
      // mark the inbound crypto transaction failed rather than crediting it.
      await em
        .getRepository(CryptoTransaction)
        .update(
          { provider_reference: ref, direction: CryptoTxDirection.INBOUND },
          { status: CryptoTxStatus.FAILED },
        );

      // Rejected ledger entry for audit trail — no credit, matches
      // handleDepositFailed's pattern for compliance-rejected funds.
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: session.business_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'payment_session',
          reference_id: session.id,
          currency: LedgerCurrency.USDT,
          credit_usdt: 0,
          asset: payment.asset ?? '',
          network: payment.chain ?? '',
          mode: session.mode,
          status: LedgerEntryStatus.REJECTED,
          description: `Payment rejected for session ${session.reference}: ${failureReason}`,
          metadata: {
            failureReason,
            amountReceived: payment.amountReceived ?? null,
            txHash: payment.txHash ?? null,
          },
        }),
      );

      void this.webhooksService.dispatch(
        session.business_id,
        'payment.failed',
        { sessionReference: ref, failureReason },
      );
    });
  }

  // ── Invoice handlers ─────────────────────────────────

  private async handleInvoiceUpdated(
    data: CCWebhookInvoiceEventData,
  ): Promise<void> {
    if (!data.invoice?.reference) return;
    const ccRef = data.invoice.reference;

    const ccStatus = data.invoice.status;
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

  private async handleInvoicePaid(
    data: CCWebhookInvoiceEventData,
  ): Promise<void> {
    if (!data.invoice?.reference) return;
    const ccRef = data.invoice.reference;

    const invoice = await this.invoiceRepo.findOne({
      where: { provider_invoice_reference: ccRef },
    });
    if (!invoice) return;

    invoice.status = InvoiceStatus.PAID;
    invoice.paid_at = data.invoice.paidAt
      ? new Date(data.invoice.paidAt)
      : new Date();
    await this.invoiceRepo.save(invoice);

    const amountPaid = Number(data.invoice?.amountPaid);
    const totalAmount = Number(data.invoice?.amount);
    const fiatCurrency: string = data.invoice?.currency ?? invoice.currency;

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        business_id: invoice.business_id,
        tx_type: TxType.DEPOSIT,
        reference_type: 'invoice',
        reference_id: invoice.id,
        currency: LedgerCurrency.USDT,
        credit_usdt: amountPaid,
        mode: invoice.mode,
        // asset: data.invoice?.payment?.asset ?? '',
        // network: data.invoice?.payment?.network ?? '',
        status: LedgerEntryStatus.COMPLETED,
        description: `Invoice ${invoice.invoice_number} paid`,
        metadata: {
          fiatCurrency,
          amountPaid,
          totalAmount,
        },
      }),
    );
  }

  private async handleInvoiceExpired(
    data: CCWebhookInvoiceEventData,
  ): Promise<void> {
    const ccRef = data.invoice?.reference;
    if (!ccRef) return;

    await this.invoiceRepo.update(
      { provider_invoice_reference: ccRef },
      { status: InvoiceStatus.OVERDUE },
    );
  }

  // ── Payout handlers ──────────────────────────────────

  private async handlePayoutCreated(
    data: CCWebhookPayoutEventData,
  ): Promise<void> {
    const ref = data.payout?.id ?? data.payout?.reference;
    if (!ref) return;

    const payout = await this.dataSource.getRepository(Payout).findOne({
      where: { provider_payout_id: ref },
      select: ['id', 'business_id'],
    });
    if (!payout) {
      this.logger.log(`Payout initiated: ${ref}`);
      return;
    }

    void this.webhooksService.dispatch(payout.business_id, 'payout.created', {
      payoutId: ref,
    });
  }

  private async handlePayoutSuccess(
    data: CCWebhookPayoutEventData,
  ): Promise<void> {
    const ref = data.payout?.id ?? data.payout?.reference;
    if (!ref) return;

    await this.dataSource.transaction(async (em) => {
      const payout = await em
        .getRepository(Payout)
        .findOne({ where: { provider_payout_id: ref } });
      if (!payout) return;

      await em
        .getRepository(Payout)
        .update(
          { provider_payout_id: ref },
          { status: PayoutStatus.COMPLETED, completed_at: new Date() },
        );

      const isOfframp = !!payout.metadata?.swapRecordId;
      const ledger = em.getRepository(LedgerEntry);

      // Confirm the net payout debit (shared by both paths — written at initiation)
      await ledger.update(
        { reference_type: 'payout', reference_id: payout.id },
        { status: LedgerEntryStatus.COMPLETED },
      );

      const feeRef = isOfframp ? `${payout.id}_plat_fee` : `${payout.id}_fee`;
      await ledger.update(
        { reference_id: feeRef },
        { status: LedgerEntryStatus.COMPLETED },
      );

      if (isOfframp) {
        await em
          .getRepository(CryptoTransaction)
          .update(
            { provider_reference: ref, direction: CryptoTxDirection.OUTBOUND },
            { status: CryptoTxStatus.COMPLETED, completed_at: new Date() },
          );
      }

      void this.webhooksService.dispatch(payout.business_id, 'payout.success', {
        payoutId: ref,
        amount: payout.amount,
      });

      if (isOfframp) {
        void this.webhooksService.dispatch(
          payout.business_id,
          'offramp.completed',
          { payoutId: ref, amount: payout.amount },
        );
      }
    });
  }

  private async handlePayoutFailed(
    data: CCWebhookPayoutEventData,
  ): Promise<void> {
    const ref = data.payout?.id ?? data.payout?.reference;
    if (!ref) return;

    await this.dataSource.transaction(async (em) => {
      const payout = await em
        .getRepository(Payout)
        .findOne({ where: { provider_payout_id: ref } });
      if (!payout) return;

      await em.getRepository(Payout).update(
        { provider_payout_id: ref },
        {
          status: PayoutStatus.FAILED,
          failure_reason: data.payout?.failureReason ?? 'Unknown',
        },
      );

      const isOfframp = !!payout.metadata?.swapRecordId;
      const ledger = em.getRepository(LedgerEntry);

      // Reverse the net payout debit (shared by both paths)
      await ledger.update(
        { reference_type: 'payout', reference_id: payout.id },
        { status: LedgerEntryStatus.REVERSED },
      );

      const feeRef = isOfframp ? `${payout.id}_plat_fee` : `${payout.id}_fee`;
      await ledger.update(
        { reference_id: feeRef },
        { status: LedgerEntryStatus.REVERSED },
      );

      if (isOfframp) {
        await em
          .getRepository(CryptoTransaction)
          .update(
            { provider_reference: ref, direction: CryptoTxDirection.OUTBOUND },
            { status: CryptoTxStatus.FAILED },
          );
      }

      void this.webhooksService.dispatch(payout.business_id, 'payout.failed', {
        payoutId: ref,
        reason: data.payout?.failureReason ?? 'Unknown',
      });

      if (isOfframp) {
        void this.webhooksService.dispatch(
          payout.business_id,
          'offramp.failed',
          { payoutId: ref, reason: data.payout?.failureReason ?? 'Unknown' },
        );
      }
    });
  }

  // ── Refund handlers ──────────────────────────────────

  /** Resolve which business a refund belongs to via the session/invoice it references. */
  private async resolveRefundContext(refund: CCWebhookRefund): Promise<{
    businessId: string | null;
    session: PaymentSession | null;
    invoice: Invoice | null;
  }> {
    let session: PaymentSession | null = null;
    let invoice: Invoice | null = null;

    if (refund.entity === 'session') {
      session = await this.sessionRepo.findOne({
        where: { provider_session_reference: refund.reference },
        select: ['business_id', 'mode'],
      });
    } else if (refund.entity === 'invoice') {
      invoice = await this.invoiceRepo.findOne({
        where: { provider_invoice_reference: refund.reference },
        select: ['business_id', 'mode'],
      });
    }

    return {
      businessId: session?.business_id ?? invoice?.business_id ?? null,
      session,
      invoice,
    };
  }

  private async handleRefundCreated(
    data: CCWebhookRefundEventData,
  ): Promise<void> {
    const refund = data.refund;
    if (!refund) return;

    const { businessId } = await this.resolveRefundContext(refund);
    if (!businessId) {
      this.logger.log(`Refund initiated: ${refund.id}`);
      return;
    }

    void this.webhooksService.dispatch(businessId, 'refund.created', {
      refundId: refund.id,
      reference: refund.reference,
    });
  }

  private async handleRefundFailed(
    data: CCWebhookRefundEventData,
  ): Promise<void> {
    const refund = data.refund;
    if (!refund) return;

    const { businessId } = await this.resolveRefundContext(refund);
    if (!businessId) {
      this.logger.warn(`Refund failed: ${refund.id}`);
      return;
    }

    void this.webhooksService.dispatch(businessId, 'refund.failed', {
      refundId: refund.id,
      reference: refund.reference,
    });
  }

  private async handleRefundSuccess(
    data: CCWebhookRefundEventData,
  ): Promise<void> {
    const refund = data.refund;
    if (!refund) return;

    const {
      businessId: developerId,
      session,
      invoice,
    } = await this.resolveRefundContext(refund);

    if (!developerId) {
      this.logger.warn(
        `refund.success: no local record found for ${refund.entity} ref=${refund.reference}`,
      );
      return;
    }

    const debitAmount = Number(refund.amount ?? 0);
    const fiatCurrency: string = refund.fiatCurrency ?? '';

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        business_id: developerId,
        tx_type: TxType.REFUND,
        reference_type: refund.entity,
        reference_id: refund.id,
        currency: LedgerCurrency.USDT,
        debit_usdt: debitAmount,
        asset: refund.asset ?? '',
        network: refund.chain ?? '',
        mode: session?.mode ?? invoice?.mode,
        status: LedgerEntryStatus.COMPLETED,
        description: `Refund for ${refund.entity} ${refund.reference}`,
        metadata: {
          txHash: refund.txHash,
          refundAddress: refund.refundAddress,
          fiatCurrency,
          fiatAmount: refund.fiatAmount,
        },
      }),
    );

    void this.webhooksService.dispatch(developerId, 'refund.success', {
      refundId: refund.id,
      reference: refund.reference,
      amount: debitAmount,
    });
  }

  // ── Swap handlers ────────────────────────────────────

  private async handleSwapCompleted(
    data: CCWebhookSwapEventData,
  ): Promise<void> {
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
        business_id: record.business_id,
        tx_type: TxType.SWAP,
        reference_type: 'swap',
        reference_id: record.id,
        currency:
          toCurrency === 'NGN'
            ? LedgerCurrency.NGN
            : toCurrency === 'USDC'
              ? LedgerCurrency.USDC
              : LedgerCurrency.USDT,
        debit_ngn: fromCurrency === 'NGN' ? sourceAmount : 0,
        debit_usdc: fromCurrency === 'USDC' ? sourceAmount : 0,
        debit_usdt: fromCurrency === 'USDT' ? sourceAmount : 0,
        credit_ngn: toCurrency === 'NGN' ? targetAmount : 0,
        credit_usdc: toCurrency === 'USDC' ? targetAmount : 0,
        credit_usdt: toCurrency === 'USDT' ? targetAmount : 0,
        asset: fromCurrency,
        mode: record.mode,
        status: LedgerEntryStatus.COMPLETED,
        description: `Swap ${sourceAmount} ${fromCurrency} → ${targetAmount} ${toCurrency} @ ${swap.rate}`,
        metadata: { quotationId: swap.quotation?.id, rate: swap.rate },
      }),
    );

    void this.webhooksService.dispatch(record.business_id, 'swap.completed', {
      swapId: swap.id,
      sourceAmount,
      targetAmount,
      fromCurrency,
      toCurrency,
    });

    // OFFRAMP: auto-trigger NGN payout to the developer's bank
    if (record.type === SwapRecordType.OFFRAMP) {
      await this.triggerOfframpPayout(record, targetAmount);
    }
  }

  private async triggerOfframpPayout(
    record: SwapRecord,
    grossNgn: number,
  ): Promise<void> {
    const meta = record.metadata as {
      recipientId: string;
      fee: number;
      quotationId?: string;
    };
    const fee = Number(meta.fee);
    const netNgn = grossNgn - fee;
    const platformId = this.platformCtx.getBusinessId();

    // CC call first — if it fails, nothing is written
    let payoutData: CCPayoutResult;
    try {
      const result = await this.cc.initiatePayout(record.mode, {
        recipientId: meta.recipientId,
        amount: netNgn.toFixed(2),
        currency: 'NGN',
        narration: 'Offramp payout',
      });
      payoutData = result.data as CCPayoutResult;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Offramp payout failed for swap ${record.cc_swap_id}: ${message}`,
      );
      return;
    }

    await this.dataSource.transaction(async (em) => {
      // Save payout first to get its local ID for ledger references
      const payout = await em.getRepository(Payout).save(
        em.getRepository(Payout).create({
          business_id: record.business_id,
          mode: record.mode,
          amount: netNgn,
          fee,
          bank_code: null,
          account_number: null,
          narration: 'Offramp payout',
          status: PayoutStatus.PENDING,
          provider_payout_id: payoutData.id,
          metadata: { swapRecordId: record.id, recipientId: meta.recipientId },
        }),
      );

      // Fee entries — PENDING until payout.success confirms delivery
      await em.getRepository(LedgerEntry).save([
        em.getRepository(LedgerEntry).create({
          business_id: platformId,
          mode: record.mode,
          tx_type: TxType.FEE,
          reference_type: 'offramp_plat_fee',
          reference_id: `${payout.id}_plat_fee`,
          currency: LedgerCurrency.NGN,
          credit_ngn: fee,
          status: LedgerEntryStatus.PENDING,
          description: `Fee income: offramp (${fee}%)`,
        }),
        // Net payout debit — PENDING until delivery confirmed
        em.getRepository(LedgerEntry).create({
          business_id: record.business_id,
          mode: record.mode,
          tx_type: TxType.OFFRAMP,
          reference_type: 'payout',
          reference_id: payout.id,
          currency: LedgerCurrency.NGN,
          debit_ngn: netNgn,
          status: LedgerEntryStatus.PENDING,
          description: `Offramp payout: ₦${netNgn.toFixed(2)}`,
        }),
      ]);

      // Outbound CryptoTransaction — INITIATED here
      await em.getRepository(CryptoTransaction).save(
        em.getRepository(CryptoTransaction).create({
          business_id: record.business_id,
          mode: record.mode,
          direction: CryptoTxDirection.OUTBOUND,
          crypto_asset: this.toCryptoAsset(record.from_currency),
          amount: record.source_amount,
          net_amount: netNgn,
          currency: LedgerCurrency.NGN,
          fee,
          status: CryptoTxStatus.INITIATED,
          provider_reference: payoutData.id,
          description: `Offramp ${record.source_amount} ${record.from_currency} → ₦${netNgn.toFixed(2)}`,
          metadata: {
            swapRecordId: record.id,
            quotationId: meta.quotationId,
          },
        }),
      );
    });

    void this.webhooksService.dispatch(
      record.business_id,
      'offramp.processing',
      { swapId: record.cc_swap_id, payoutId: payoutData.id, amount: netNgn },
    );

    this.logger.log(
      `Offramp payout ${payoutData.id} initiated: ₦${netNgn.toFixed(2)} (fee ₦${fee.toFixed(2)})`,
    );
  }

  private async handleSwapFailed(data: CCWebhookSwapEventData): Promise<void> {
    const swap = data.swap;
    if (!swap?.id) return;

    const record = await this.swapRecordRepo.findOne({
      where: { cc_swap_id: swap.id },
    });

    await this.swapRecordRepo.update(
      { cc_swap_id: swap.id },
      { status: SwapRecordStatus.FAILED },
    );

    this.logger.warn(
      `Swap failed: ${swap.id} (${swap.fromCurrency} → ${swap.toCurrency})`,
    );

    if (!record) return;

    void this.webhooksService.dispatch(record.business_id, 'swap.failed', {
      swapId: swap.id,
      fromCurrency: swap.fromCurrency,
      toCurrency: swap.toCurrency,
    });

    if (record.type === SwapRecordType.OFFRAMP) {
      void this.webhooksService.dispatch(record.business_id, 'offramp.failed', {
        swapId: swap.id,
        reason: 'Swap failed before payout could be initiated',
      });
    }
  }

  private buildDepositFiatMetadata(data: CCWebhookDeposit) {
    const fiat = data.fiat;
    return {
      customerId: data.customer?.id ?? null,
      customerEmail: data.customer?.email ?? null,
      fiatMethod: fiat?.method ?? null,
      fiatReference: fiat?.reference ?? null,
      payer: fiat?.payer
        ? {
            accountName: fiat.payer.accountName ?? null,
            accountNumber: fiat.payer.accountNumber ?? null,
            bankName: fiat.payer.bankName ?? null,
            bankCode: fiat.payer.bankCode ?? null,
          }
        : null,
      payee: fiat?.payee
        ? {
            accountName: fiat.payee.accountName ?? null,
            accountNumber: fiat.payee.accountNumber ?? null,
            bankName: fiat.payee.bankName ?? null,
            bankCode: fiat.payee.bankCode ?? null,
          }
        : null,
      ngnVirtualAccount: fiat?.ngnVirtualAccount
        ? {
            accountName: fiat.ngnVirtualAccount.accountName ?? null,
            accountNumber: fiat.ngnVirtualAccount.accountNumber ?? null,
            accountReference: fiat.ngnVirtualAccount.accountReference ?? null,
            bankName: fiat.ngnVirtualAccount.bankName ?? null,
            bankCode: fiat.ngnVirtualAccount.bankCode ?? null,
            currency: fiat.ngnVirtualAccount.currency ?? null,
          }
        : null,
    };
  }

  // ── Deposit account handlers ─────────────────────────

  private async handleDepositProcessing(data: CCWebhookDeposit): Promise<void> {
    this.logger.log(
      `Deposit processing: ${data.id} — ${data.amount} ${data.currency} (${data.type})`,
    );

    if (!data.depositAccountId) return;

    const account = await this.walletRepo.findOne({
      where: { id: data.depositAccountId },
      select: ['id', 'business_id'],
    });
    if (!account) return;

    // Idempotent — skip if already recorded
    const existing = await this.cryptoTxRepo.findOne({
      where: { cc_transaction_id: data.id },
    });
    if (existing) return;

    const isCrypto = data.type === 'crypto';
    await this.cryptoTxRepo.save(
      this.cryptoTxRepo.create({
        business_id: account.business_id,
        direction: CryptoTxDirection.INBOUND,
        cc_transaction_id: data.id,
        deposit_type: data.type ?? null,
        crypto_asset: isCrypto ? this.toCryptoAsset(data.crypto?.asset) : null,
        network: isCrypto ? this.toCryptoNetwork(data.crypto?.chain) : null,
        from_address: isCrypto ? (data.crypto?.fromAddress ?? null) : null,
        to_address: isCrypto ? (data.crypto?.toAddress ?? null) : null,
        tx_hash: data.crypto?.txHash ?? null,
        amount: Number(data.amount),
        net_amount: Number(data.netAmount),
        currency: data.currency,
        fee: data.fee != null ? Number(data.fee) : 0,
        status: CryptoTxStatus.PROCESSING,
        mode: account.mode,
        description: `${isCrypto ? 'Crypto' : 'Bank'} deposit processing: ${data.amount} ${data.currency}`,
        metadata: this.buildDepositFiatMetadata(data),
      }),
    );

    void this.webhooksService.dispatch(
      account.business_id,
      'deposit.processing',
      { depositId: data.id, amount: data.amount, currency: data.currency },
    );
  }

  private async handleDepositCompleted(data: CCWebhookDeposit): Promise<void> {
    if (!data.depositAccountId) {
      this.logger.warn(
        `deposit.completed: missing depositAccountId in payload`,
      );
      return;
    }

    const account = await this.walletRepo.findOne({
      where: { id: data.depositAccountId },
      select: ['id', 'business_id', 'mode'],
    });

    if (!account) {
      this.logger.warn(
        `deposit.completed: no deposit account found for ${data.depositAccountId}`,
      );
      return;
    }

    const isCrypto = data.type === 'crypto';
    const netAmount = Number(data.netAmount);
    const currency: string = data.currency;
    const asset: string = data.crypto?.asset ?? '';
    const network: string = data.crypto?.chain ?? '';
    const isNGN = currency === 'NGN';
    const isUSDT = currency === 'USDT';
    const isUSDC = currency === 'USDC';
    const ledgerCurrency = isNGN
      ? LedgerCurrency.NGN
      : isUSDT
        ? LedgerCurrency.USDT
        : LedgerCurrency.USDC;

    await this.dataSource.transaction(async (em) => {
      // Update existing CryptoTransaction if it was created at processing time
      const txUpdates: Partial<CryptoTransaction> = {
        status: CryptoTxStatus.COMPLETED,
        completed_at: new Date(),
        amount: Number(data.amount),
        net_amount: Number(data.netAmount),
        currency,
        tx_hash: data.crypto?.txHash ?? undefined,
      };

      const updateResult = await em
        .getRepository(CryptoTransaction)
        .update({ cc_transaction_id: data.id }, txUpdates);

      // If no existing record (deposit.processing may not have fired), create it now
      if (updateResult.affected === 0) {
        await em.getRepository(CryptoTransaction).save(
          em.getRepository(CryptoTransaction).create({
            business_id: account.business_id,
            direction: CryptoTxDirection.INBOUND,
            cc_transaction_id: data.id,
            deposit_type: data.type ?? null,
            crypto_asset: isCrypto
              ? this.toCryptoAsset(data.crypto?.asset)
              : null,
            network: isCrypto ? this.toCryptoNetwork(data.crypto?.chain) : null,
            from_address: isCrypto ? (data.crypto?.fromAddress ?? null) : null,
            to_address: isCrypto ? (data.crypto?.toAddress ?? null) : null,
            tx_hash: data.crypto?.txHash ?? null,
            amount: Number(data.amount),
            net_amount: Number(data.netAmount),
            currency,
            fee: data.fee != null ? Number(data.fee) : 0,
            status: CryptoTxStatus.COMPLETED,
            completed_at: new Date(),
            mode: account.mode,
            description: `${isCrypto ? 'Crypto' : 'Bank'} deposit: ${data.amount} ${currency}`,
            metadata: this.buildDepositFiatMetadata(data),
          }),
        );
      }

      // Credit developer ledger
      await em.getRepository(LedgerEntry).save(
        em.getRepository(LedgerEntry).create({
          business_id: account.business_id,
          tx_type: TxType.DEPOSIT,
          reference_type: 'deposit',
          reference_id: data.id,
          deposit_account_id: data.depositAccountId,
          currency: ledgerCurrency,
          credit_ngn: isNGN ? netAmount : 0,
          credit_usdt: isUSDT ? netAmount : 0,
          credit_usdc: isUSDC ? netAmount : 0,
          asset,
          network,
          status: LedgerEntryStatus.COMPLETED,
          mode: account.mode,
          description: `${isCrypto ? 'Crypto' : 'Bank'} deposit: ${data.amount} ${currency}`,
          metadata: {
            depositId: data.id,
            netAmount,
            fee: data.fee ?? null,
            txHash: data.crypto?.txHash ?? null,
            chain: data.crypto?.chain ?? null,
            fromAddress: data.crypto?.fromAddress ?? null,
            toAddress: data.crypto?.toAddress ?? null,
            customerId: data.customer?.id ?? null,
            payerName: data.fiat?.payer?.accountName ?? null,
            payerBank: data.fiat?.payer?.bankName ?? null,
          },
        }),
      );
    });

    void this.webhooksService.dispatch(
      account.business_id,
      'deposit.confirmed',
      { depositId: data.id, amount: netAmount, currency },
    );

    this.logger.log(
      `Deposit completed: ${data.id} — ${data.netAmount ?? data.amount} ${currency} credited to ${account.business_id}`,
    );
  }

  private async handleDepositFailed(data: CCWebhookDeposit): Promise<void> {
    this.logger.warn(
      `Deposit failed: ${data.id} — ${data.amount} ${data.currency}`,
    );

    if (!data.depositAccountId) return;

    const account = await this.walletRepo.findOne({
      where: { id: data.depositAccountId },
      select: ['business_id'],
    });
    if (!account) return;

    // Update CryptoTransaction status if it exists
    await this.cryptoTxRepo.update(
      { cc_transaction_id: data.id },
      { status: CryptoTxStatus.FAILED },
    );

    // Rejected ledger entry for audit trail
    const currency: string = data.currency;
    const asset: string = data.crypto?.asset ?? '';
    const network: string = data.crypto?.chain ?? '';
    const isNGN = currency === 'NGN';
    const isUSDT = currency === 'USDT';
    // const isUSDC = currency === 'USDC';

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        business_id: account.business_id,
        tx_type: TxType.DEPOSIT,
        reference_type: 'deposit',
        reference_id: data.id,
        deposit_account_id: data.depositAccountId,
        currency: isNGN
          ? LedgerCurrency.NGN
          : isUSDT
            ? LedgerCurrency.USDT
            : LedgerCurrency.USDC,
        credit_ngn: 0,
        credit_usdt: 0,
        credit_usdc: 0,
        asset,
        network,
        mode: account.mode,
        status: LedgerEntryStatus.REJECTED,
        description: `Failed deposit: ${data.amount} ${currency}`,
        metadata: {
          depositId: data.id,
          txHash: data.crypto?.txHash ?? null,
          customerId: data.customer?.id ?? null,
        },
      }),
    );

    void this.webhooksService.dispatch(account.business_id, 'deposit.failed', {
      depositId: data.id,
      amount: data.amount,
      currency,
    });
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
