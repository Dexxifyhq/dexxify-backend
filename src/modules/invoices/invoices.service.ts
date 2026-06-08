import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, InvoiceLineItem } from '../../database/entities';
import { parsePagination, buildPaginationMeta, generateUniqueId } from '../../common/utils';
import { CreateInvoiceDto, InvoiceLineItemDto, InvoiceQueryDto, UpdateInvoiceDto } from './dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async create(developerId: string, dto: CreateInvoiceDto) {
    const { subtotal, taxAmount, total, lineItems } = this.calculateTotals(
      dto.line_items,
      dto.tax_rate ?? 0,
      dto.discount_amount ?? 0,
    );

    const invoice = this.invoiceRepo.create({
      developer_id: developerId,
      customer_id: dto.customer_id || null,
      invoice_number: `INV-${generateUniqueId().toUpperCase().slice(0, 10)}`,
      status: InvoiceStatus.DRAFT,
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

    return this.invoiceRepo.save(invoice);
  }

  async findAll(developerId: string, query: InvoiceQueryDto) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.developer_id = :developerId', { developerId });

    if (query.status) qb.andWhere('inv.status = :status', { status: query.status });
    if (query.customer_id)
      qb.andWhere('inv.customer_id = :customer_id', { customer_id: query.customer_id });

    qb.orderBy('inv.created_at', 'DESC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(developerId: string, invoiceId: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, developer_id: developerId },
      relations: ['customer'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async update(developerId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(developerId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be updated.');
    }

    const lineItems = dto.line_items
      ? dto.line_items
      : (invoice.line_items as InvoiceLineItemDto[]);
    const taxRate = dto.tax_rate ?? invoice.tax_rate;
    const discountAmount = dto.discount_amount ?? invoice.discount_amount;

    const { subtotal, taxAmount, total, lineItems: computedItems } =
      this.calculateTotals(lineItems, taxRate, discountAmount);

    Object.assign(invoice, {
      line_items: computedItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      ...(dto.due_date !== undefined && { due_date: dto.due_date ? new Date(dto.due_date) : null }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });

    return this.invoiceRepo.save(invoice);
  }

  async send(developerId: string, invoiceId: string) {
    const invoice = await this.findOne(developerId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot send an invoice with status '${invoice.status}'.`);
    }

    invoice.status = InvoiceStatus.SENT;
    return this.invoiceRepo.save(invoice);
  }

  async markPaid(developerId: string, invoiceId: string) {
    const invoice = await this.findOne(developerId, invoiceId);

    if (
      invoice.status !== InvoiceStatus.SENT &&
      invoice.status !== InvoiceStatus.VIEWED &&
      invoice.status !== InvoiceStatus.OVERDUE
    ) {
      throw new BadRequestException(`Cannot mark invoice as paid from status '${invoice.status}'.`);
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paid_at = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async cancel(developerId: string, invoiceId: string) {
    const invoice = await this.findOne(developerId, invoiceId);

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException(`Cannot cancel an invoice with status '${invoice.status}'.`);
    }

    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  async void(developerId: string, invoiceId: string) {
    const invoice = await this.findOne(developerId, invoiceId);

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
  ): { subtotal: number; taxAmount: number; total: number; lineItems: InvoiceLineItem[] } {
    const lineItems: InvoiceLineItem[] = rawItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.quantity * item.unit_price,
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));

    return { subtotal, taxAmount, total, lineItems };
  }
}
