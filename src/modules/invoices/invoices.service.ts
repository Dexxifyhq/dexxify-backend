import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  Customer,
  PaymentSession,
  PaymentSessionStatus,
} from '../../database/entities';
import {
  parsePagination,
  buildPaginationMeta,
  generateUniqueId,
} from '../../common/utils';
import {
  CreateInvoiceDto,
  InvoiceLineItemDto,
  InvoicePaymentDto,
  InvoiceQueryDto,
} from './dto';
import {
  CoincircuitService,
  toCCAsset,
  toCCChain,
} from '../../providers/coincircuit/coincircuit.service';
import { CCPaymentSessionData } from '../payment-sessions/payment-sessions.service';

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    private readonly cc: CoincircuitService,
  ) {}

  async create(
    businessId: string,
    mode: 'live' | 'test',
    dto: CreateInvoiceDto,
  ) {
    let customer = await this.customerRepo.findOne({
      where: { email: dto.customer.email, business_id: businessId, mode },
    });

    if (!customer) {
      const created = await this.customerRepo.save(
        this.customerRepo.create({
          business_id: businessId,
          mode,
          email: dto.customer.email,
          first_name: dto.customer.first_name,
          last_name: dto.customer.last_name,
          phone: dto.customer.phone,
        }),
      );
      this.logger.log(`New customer created: ${created.id}`);
      customer = created;
    }

    const { subtotal, taxAmount, total, lineItems } = this.calculateTotals(
      dto.line_items,
      dto.tax_rate ?? 0,
      dto.discount_amount ?? 0,
      dto.currency ?? 'USD',
    );

    const invoice = this.invoiceRepo.create({
      business_id: businessId,
      mode,
      customer_id: customer.id,
      invoice_number: `INV-${generateUniqueId().toUpperCase().slice(0, 10)}`,
      status: InvoiceStatus.SENT,
      currency: dto.currency?.toUpperCase() || 'USD',
      line_items: lineItems,
      subtotal,
      tax_rate: dto.tax_rate ?? 0,
      tax_amount: taxAmount,
      discount_amount: dto.discount_amount ?? 0,
      total,
      due_date: dto.due_date ? new Date(dto.due_date) : null,
      notes: dto.notes || null,
      metadata: dto.metadata || {},
    });

    const saved = await this.invoiceRepo.save(invoice);
    this.logger.log(`Invoice created: ${saved.invoice_number}`);
    return saved;
  }

  async findAll(
    businessId: string,
    mode: 'live' | 'test',
    query: InvoiceQueryDto,
  ) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.mode = :mode', { mode });

    if (query.status)
      qb.andWhere('inv.status = :status', { status: query.status });
    if (query.customer_id)
      qb.andWhere('inv.customer_id = :customer_id', {
        customer_id: query.customer_id,
      });

    qb.orderBy('inv.created_at', 'DESC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(businessId: string, mode: 'live' | 'test', invoiceId: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, business_id: businessId, mode },
      relations: ['customer'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async findOneEnriched(
    businessId: string,
    mode: 'live' | 'test',
    invoiceId: string,
  ) {
    const invoice = await this.findOne(businessId, mode, invoiceId);

    if (invoice.provider_invoice_reference) {
      try {
        const ccResult = await this.cc.getInvoice(
          mode,
          invoice.provider_invoice_reference,
        );
        return { ...invoice, cc: ccResult?.data as CCPaymentSessionData };
      } catch (err) {
        this.logger.warn(
          `CC invoice fetch failed for ${invoiceId}: ${getErrorMessage(err)}`,
        );
      }
    }

    return invoice;
  }

  /** Public — no developer scoping. Used by the customer pay page. */
  async findByNumber(invoiceNumber: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { invoice_number: invoiceNumber },
      relations: ['customer'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  /**
   * Public — customer selects their preferred crypto asset/network and we
   * create a CC payment session tied to this invoice. When payment.completed
   * fires, the webhook marks the invoice PAID automatically.
   */
  async createPaymentSession(invoiceNumber: string, dto: InvoicePaymentDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { invoice_number: invoiceNumber },
      relations: ['customer'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');

    if (invoice.status === InvoiceStatus.PAID)
      throw new BadRequestException('Invoice is already paid.');
    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.VOID
    )
      throw new BadRequestException(`Invoice is ${invoice.status}.`);

    const ccResult = await this.cc.createPaymentSession(invoice.mode, {
      title: `Invoice ${invoice.invoice_number}`,
      description: invoice.notes || `Invoice ${invoice.invoice_number}`,
      amount: String(invoice.total),
      currency: invoice.currency as 'NGN' | 'USD',
      asset: toCCAsset(dto.crypto_asset),
      chain: toCCChain(dto.network),
      ...(invoice.customer && {
        customer: {
          email: invoice.customer.email,
          firstName: invoice.customer.first_name || undefined,
          lastName: invoice.customer.last_name || undefined,
        },
      }),
      metadata: { invoice_number: invoice.invoice_number },
    });

    const ccData = ccResult?.data as CCPaymentSessionData | undefined;

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        business_id: invoice.business_id,
        mode: invoice.mode,
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        reference: `ps_${generateUniqueId().slice(4, 12)}`,
        amount: invoice.total,
        currency: invoice.currency,
        crypto_asset: dto.crypto_asset,
        deposit_address: ccData?.payment?.address || null,
        network: dto.network,
        status: PaymentSessionStatus.PENDING,
        provider_session_reference: ccData?.reference ?? null,
        expires_at: ccData?.expiresAt ? new Date(ccData.expiresAt) : undefined,
        metadata: { invoice_number: invoice.invoice_number, ...ccData },
      }),
    );

    this.logger.log(
      `Payment session ${session.reference} created for invoice ${invoiceNumber}`,
    );
    return session;
  }

  async markPaid(businessId: string, mode: 'live' | 'test', invoiceId: string) {
    const invoice = await this.findOne(businessId, mode, invoiceId);

    if (
      invoice.status !== InvoiceStatus.SENT &&
      invoice.status !== InvoiceStatus.VIEWED &&
      invoice.status !== InvoiceStatus.OVERDUE
    ) {
      throw new BadRequestException(
        `Cannot mark invoice as paid from status '${invoice.status}'.`,
      );
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paid_at = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async cancel(businessId: string, mode: 'live' | 'test', invoiceId: string) {
    const invoice = await this.findOne(businessId, mode, invoiceId);

    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.VOID
    ) {
      throw new BadRequestException(
        `Cannot cancel an invoice with status '${invoice.status}'.`,
      );
    }

    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  async void(businessId: string, mode: 'live' | 'test', invoiceId: string) {
    const invoice = await this.findOne(businessId, mode, invoiceId);

    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Only paid invoices can be voided.');
    }

    invoice.status = InvoiceStatus.VOID;
    return this.invoiceRepo.save(invoice);
  }

  private calculateTotals(
    rawItems: InvoiceLineItemDto[],
    taxRate: number,
    discountAmount: number,
    currency: string,
  ): {
    subtotal: number;
    taxAmount: number;
    total: number;
    lineItems: InvoiceLineItem[];
  } {
    const lineItems: InvoiceLineItem[] = rawItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.quantity * item.unit_price,
    }));

    if (currency.toUpperCase() === 'NGN') {
      const invalid = lineItems.find((item) => item.amount <= 3000);
      if (invalid) {
        throw new BadRequestException(
          `Each line item amount must be greater than ₦3,000 for NGN invoices (got ₦${invalid.amount} for "${invalid.description}").`,
        );
      }
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    const total = parseFloat(
      (subtotal + taxAmount - discountAmount).toFixed(2),
    );

    return { subtotal, taxAmount, total, lineItems };
  }
}
