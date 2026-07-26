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
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, InvoicePaymentDto, InvoiceQueryDto } from './dto';
import { DualAuth, GetBusinessId, GetMode, Public } from '../../common/decorators';

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
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List invoices' })
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
