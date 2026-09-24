import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, InvoicePaymentDto, InvoiceQueryDto } from './dto';
import {
  DualAuth,
  GetBusinessId,
  GetMode,
  Public,
} from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { Invoice, PaymentSession } from '../../database/entities';

const CUSTOMER_EXAMPLE = {
  id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  email: 'john@example.com',
  phone: '08012345678',
  first_name: 'John',
  last_name: 'Doe',
  status: 'active',
  cc_customer_id: null,
  metadata: {},
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const INVOICE_EXAMPLE = {
  id: '9b1d6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e70',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  customer_id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  invoice_number: 'INV-AB12CD34EF',
  status: 'sent',
  currency: 'USD',
  line_items: [
    {
      description: 'Consulting services',
      quantity: 2,
      unit_price: 500,
      amount: 1000,
    },
  ],
  subtotal: 1000,
  tax_rate: 7.5,
  tax_amount: 75,
  discount_amount: 50,
  total: 1025,
  due_date: '2026-07-01T00:00:00.000Z',
  paid_at: null,
  notes: 'Thank you for your business.',
  provider_invoice_reference: null,
  cc_invoice_url: null,
  metadata: { order_ref: 'ord_123' },
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const INVOICE_WITH_CUSTOMER_EXAMPLE = {
  ...INVOICE_EXAMPLE,
  customer: CUSTOMER_EXAMPLE,
};

const PAYMENT_SESSION_EXAMPLE = {
  id: '6a0ce752-6932-4c1c-b5ea-fe7d12345678',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  customer_id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  reference: 'ps_4f9a1a2b3c4d',
  amount: 1025,
  amount_paid: null,
  currency: 'USD',
  deposit_address: 'TXkPqR7YbAaHqZ5t5fRZ9Zk3f2NcQvJ9f2A',
  crypto_asset: 'USDT',
  network: 'Tron',
  status: 'pending',
  payment_page_id: null,
  invoice_id: '9b1d6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e70',
  transaction_id: null,
  provider_session_reference: 'cc_sess_8f2a1b3c',
  metadata: { invoice_number: 'INV-AB12CD34EF' },
  expires_at: '2026-09-01T10:45:00.000Z',
  completed_at: null,
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

@ApiTags('Invoices')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @ApiOperation({
    summary: 'Create and send an invoice',
    description:
      'Creates an invoice via CoincircuitMCP and saves it to the database. Returns the invoice including a payment URL to share with your customer.',
  })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiCreatedResponse({
    description: 'Invoice created successfully.',
    type: Invoice,
    example: INVOICE_EXAMPLE,
  })
  @ApiErrorResponses(
    {
      status: 400,
      message:
        'Each line item amount must be greater than ₦3,000 for NGN invoices (got ₦2,000 for "Consulting services").',
    },
    401,
  )
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List invoices' })
  @ApiOkResponse({
    description: 'Invoices retrieved successfully.',
    schema: {
      example: {
        data: [INVOICE_EXAMPLE],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    },
  })
  @ApiErrorResponses(401)
  @Get()
  findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: InvoiceQueryDto,
  ) {
    return this.invoicesService.findAll(businessId, mode, query);
  }

  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Returns local invoice data enriched with live CC status.',
  })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @ApiOkResponse({
    description: 'Invoice retrieved successfully.',
    type: Invoice,
    example: INVOICE_WITH_CUSTOMER_EXAMPLE,
  })
  @ApiErrorResponses(401, { status: 404, message: 'Invoice not found.' })
  @Get(':invoice_id')
  findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.findOneEnriched(businessId, mode, invoiceId);
  }

  @ApiOperation({
    summary: 'Get invoice by number (public)',
    description:
      'Public endpoint — no auth required. Used by the customer-facing pay page to display invoice details.',
  })
  @ApiParam({
    name: 'invoice_number',
    description: 'Invoice number e.g. INV-ABC123',
  })
  @Public()
  @ApiOkResponse({
    description: 'Invoice retrieved successfully.',
    type: Invoice,
    example: INVOICE_WITH_CUSTOMER_EXAMPLE,
  })
  @ApiErrorResponses({ status: 404, message: 'Invoice not found.' })
  @Get('pay/:invoice_number')
  findByNumber(@Param('invoice_number') invoiceNumber: string) {
    return this.invoicesService.findByNumber(invoiceNumber);
  }

  @ApiOperation({
    summary: 'Create payment session for invoice (public)',
    description:
      'Public endpoint — customer selects which crypto asset and network to pay with. Returns a payment session with a deposit address. The invoice is marked PAID automatically when payment.completed webhook fires.',
  })
  @ApiParam({
    name: 'invoice_number',
    description: 'Invoice number e.g. INV-ABC123',
  })
  @ApiBody({ type: InvoicePaymentDto })
  @Public()
  @ApiCreatedResponse({
    description: 'Payment session created successfully.',
    type: PaymentSession,
    example: PAYMENT_SESSION_EXAMPLE,
  })
  @ApiErrorResponses(
    { status: 400, message: 'Invoice is already paid.' },
    { status: 404, message: 'Invoice not found.' },
  )
  @HttpCode(HttpStatus.CREATED)
  @Post('pay/:invoice_number/session')
  createPaymentSession(
    @Param('invoice_number') invoiceNumber: string,
    @Body() dto: InvoicePaymentDto,
  ) {
    return this.invoicesService.createPaymentSession(invoiceNumber, dto);
  }

  @ApiOperation({ summary: 'Mark an invoice as paid' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @ApiOkResponse({
    description: 'Invoice marked as paid successfully.',
    type: Invoice,
    example: {
      ...INVOICE_EXAMPLE,
      status: 'paid',
      paid_at: '2026-09-01T12:00:00.000Z',
    },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: "Cannot mark invoice as paid from status 'paid'.",
    },
    401,
    { status: 404, message: 'Invoice not found.' },
  )
  @HttpCode(HttpStatus.OK)
  @Post(':invoice_id/mark-paid')
  markPaid(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.markPaid(businessId, mode, invoiceId);
  }

  @ApiOperation({ summary: 'Cancel an invoice' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @ApiOkResponse({
    description: 'Invoice cancelled successfully.',
    type: Invoice,
    example: { ...INVOICE_EXAMPLE, status: 'cancelled' },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: "Cannot cancel an invoice with status 'paid'.",
    },
    401,
    { status: 404, message: 'Invoice not found.' },
  )
  @HttpCode(HttpStatus.OK)
  @Post(':invoice_id/cancel')
  cancel(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.cancel(businessId, mode, invoiceId);
  }

  @ApiOperation({ summary: 'Void a paid invoice' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @ApiOkResponse({
    description: 'Invoice voided successfully.',
    type: Invoice,
    example: { ...INVOICE_EXAMPLE, status: 'void' },
  })
  @ApiErrorResponses(
    { status: 400, message: 'Only paid invoices can be voided.' },
    401,
    { status: 404, message: 'Invoice not found.' },
  )
  @HttpCode(HttpStatus.OK)
  @Post(':invoice_id/void')
  void(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.void(businessId, mode, invoiceId);
  }
}
