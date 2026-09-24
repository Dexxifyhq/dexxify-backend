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
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import {
  RefundDto,
  RefundQueryDto,
  EstimateRefundQueryDto,
  RefundEntityType,
} from './dto';
import { DualAuth, GetMode } from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

const REFUND_EXAMPLE = {
  id: 'ref_8f3c1a2b4d5e6f7a',
  sessionReference: 'CS_9f8e7d6c5b4a',
  amount: '50.00',
  currency: 'USD',
  asset: 'USDT',
  chain: 'tron',
  refundAddress: 'TXyz1234567890abcdef',
  feePaidBy: 'merchant',
  fee: '0.50',
  reason: 'Customer requested refund',
  status: 'pending',
  createdAt: '2026-09-17T12:00:00.000Z',
  updatedAt: '2026-09-17T12:00:00.000Z',
};

const REFUND_ESTIMATE_EXAMPLE = {
  data: {
    amount: '50.00',
    fee: '0.50',
    totalDeducted: '50.50',
    currency: 'USD',
    feePaidBy: 'merchant',
  },
};

@ApiTags('Refunds')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @ApiOperation({
    summary: 'Estimate refund',
    description:
      'Get refund estimation including fees and amounts before initiating.',
  })
  @ApiParam({
    name: 'reference',
    description:
      'Session reference (CS_xxxxx) or invoice reference (INV_xxxxx)',
  })
  @ApiQuery({ name: 'entity', enum: RefundEntityType, required: true })
  @ApiQuery({
    name: 'feePaidBy',
    enum: ['merchant', 'customer'],
    required: false,
  })
  @ApiOkResponse({
    description: 'Refund estimate calculated successfully.',
    schema: { example: REFUND_ESTIMATE_EXAMPLE },
  })
  @ApiErrorResponses(401, {
    status: 404,
    message: 'Refund not found for the given reference.',
  })
  @Get('estimate/:reference')
  estimate(
    @GetMode() mode: 'live' | 'test',
    @Param('reference') reference: string,
    @Query() query: EstimateRefundQueryDto,
  ) {
    return this.refundsService.estimateRefund(mode, reference, query);
  }

  @ApiOperation({
    summary: 'List refunds',
    description:
      'Returns all refunds. Filters by status, session/invoice reference, date range, or search.',
  })
  @ApiOkResponse({
    description: 'Refunds retrieved successfully.',
    schema: { example: { data: [REFUND_EXAMPLE] } },
  })
  @ApiErrorResponses(401)
  @Get()
  findAll(@GetMode() mode: 'live' | 'test', @Query() query: RefundQueryDto) {
    return this.refundsService.findAll(mode, query);
  }

  @ApiOperation({ summary: 'Get refund by ID' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiOkResponse({
    description: 'Refund retrieved successfully.',
    schema: { example: { data: REFUND_EXAMPLE } },
  })
  @ApiErrorResponses(401, { status: 404, message: 'Refund not found.' })
  @Get(':id')
  findOne(@GetMode() mode: 'live' | 'test', @Param('id') id: string) {
    return this.refundsService.findOne(mode, id);
  }

  @ApiOperation({
    summary: 'Refund a payment session',
    description:
      'Initiates a refund for a completed payment session back to the customer wallet.',
  })
  @ApiParam({
    name: 'sessionReference',
    description: 'Session reference (e.g. CS_xxxxx)',
  })
  @ApiBody({ type: RefundDto })
  @ApiCreatedResponse({
    description: 'Refund initiated successfully.',
    schema: { example: { data: REFUND_EXAMPLE } },
  })
  @ApiErrorResponses(
    { status: 400, message: 'refundAddress should not be empty' },
    401,
    { status: 404, message: 'Payment session not found.' },
  )
  @HttpCode(HttpStatus.CREATED)
  @Post('session/:sessionReference')
  refundSession(
    @GetMode() mode: 'live' | 'test',
    @Param('sessionReference') sessionReference: string,
    @Body() dto: RefundDto,
  ) {
    return this.refundsService.refundSession(mode, sessionReference, dto);
  }
}
