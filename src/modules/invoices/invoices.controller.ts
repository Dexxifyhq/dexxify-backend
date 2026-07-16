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
import { DualAuth, GetDeveloper, Public } from '../../common/decorators';

@ApiTags('Invoices')
@DualAuth()
// @ApiBearerAuth('api-key')
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
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(developerId, dto);
  }

  @ApiOperation({ summary: 'List invoices' })
  @Get()
  findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: InvoiceQueryDto,
  ) {
    return this.invoicesService.findAll(developerId, query);
  }

  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Returns local invoice data enriched with live CC status.',
  })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @Get(':invoice_id')
  findOne(
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.findOneEnriched(developerId, invoiceId);
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
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.markPaid(developerId, invoiceId);
  }

  @ApiOperation({ summary: 'Cancel an invoice' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @HttpCode(HttpStatus.OK)
  @Post(':invoice_id/cancel')
  cancel(
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.cancel(developerId, invoiceId);
  }

  @ApiOperation({ summary: 'Void a paid invoice' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @HttpCode(HttpStatus.OK)
  @Post(':invoice_id/void')
  void(
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.void(developerId, invoiceId);
  }
}
