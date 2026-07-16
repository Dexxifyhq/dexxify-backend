import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { RefundDto, RefundQueryDto, EstimateRefundQueryDto, RefundEntityType } from './dto';
import { GetDeveloper } from '../../common/decorators';

@ApiTags('Refunds')
@ApiBearerAuth('api-key')
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @ApiOperation({
    summary: 'Estimate refund',
    description: 'Get refund estimation including fees and amounts before initiating.',
  })
  @ApiParam({ name: 'reference', description: 'Session reference (CS_xxxxx) or invoice reference (INV_xxxxx)' })
  @ApiQuery({ name: 'entity', enum: RefundEntityType, required: true })
  @ApiQuery({ name: 'feePaidBy', enum: ['merchant', 'customer'], required: false })
  @Get('estimate/:reference')
  estimate(
    @Param('reference') reference: string,
    @Query() query: EstimateRefundQueryDto,
  ) {
    return this.refundsService.estimateRefund(reference, query);
  }

  @ApiOperation({
    summary: 'List refunds',
    description: 'Returns all refunds. Filters by status, session/invoice reference, date range, or search.',
  })
  @Get()
  findAll(@Query() query: RefundQueryDto) {
    return this.refundsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get refund by ID' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.refundsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Refund a payment session',
    description: 'Initiates a refund for a completed payment session back to the customer wallet.',
  })
  @ApiParam({ name: 'sessionReference', description: 'Session reference (e.g. CS_xxxxx)' })
  @ApiBody({ type: RefundDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('session/:sessionReference')
  refundSession(
    @Param('sessionReference') sessionReference: string,
    @Body() dto: RefundDto,
  ) {
    return this.refundsService.refundSession(sessionReference, dto);
  }

  @ApiOperation({
    summary: 'Refund an invoice',
    description: 'Initiates a refund for a paid invoice back to the customer wallet.',
  })
  @ApiParam({ name: 'invoiceReference', description: 'Invoice reference (e.g. INV_xxxxx)' })
  @ApiBody({ type: RefundDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('invoice/:invoiceReference')
  refundInvoice(
    @Param('invoiceReference') invoiceReference: string,
    @Body() dto: RefundDto,
  ) {
    return this.refundsService.refundInvoice(invoiceReference, dto);
  }
}
