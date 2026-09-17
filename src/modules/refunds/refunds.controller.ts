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
  @ApiOkResponse({ description: 'Refund estimate calculated successfully.' })
  @ApiErrorResponses(401, 404)
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
  @ApiOkResponse({ description: 'Refunds retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get()
  findAll(@GetMode() mode: 'live' | 'test', @Query() query: RefundQueryDto) {
    return this.refundsService.findAll(mode, query);
  }

  @ApiOperation({ summary: 'Get refund by ID' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiOkResponse({ description: 'Refund retrieved successfully.' })
  @ApiErrorResponses(401, 404)
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
  @ApiCreatedResponse({ description: 'Refund initiated successfully.' })
  @ApiErrorResponses(400, 401, 404)
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
