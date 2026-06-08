import {
  Controller,
  Get,
  Post,
  Put,
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
import { CreateInvoiceDto, InvoiceQueryDto, UpdateInvoiceDto } from './dto';
import { GetDeveloper } from '../../common/decorators';

@ApiTags('Invoices')
@ApiBearerAuth('api-key')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @ApiOperation({ summary: 'Create a draft invoice' })
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

  @ApiOperation({ summary: 'Get an invoice by ID' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @Get(':invoice_id')
  findOne(
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.findOne(developerId, invoiceId);
  }

  @ApiOperation({ summary: 'Update a draft invoice' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @ApiBody({ type: UpdateInvoiceDto })
  @Put(':invoice_id')
  update(
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(developerId, invoiceId, dto);
  }

  @ApiOperation({ summary: 'Send an invoice (draft → sent)' })
  @ApiParam({ name: 'invoice_id', description: 'Invoice UUID' })
  @HttpCode(HttpStatus.OK)
  @Post(':invoice_id/send')
  send(
    @GetDeveloper('id') developerId: string,
    @Param('invoice_id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoicesService.send(developerId, invoiceId);
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
