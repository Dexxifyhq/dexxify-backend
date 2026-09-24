import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { SwapsService } from './swaps.service';
import { EstimateSwapDto, CreateSwapQuotationDto, SwapQueryDto } from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { SwapRecord } from '../../database/entities';

const CC_SWAP_ESTIMATE_EXAMPLE = {
  data: {
    fromCurrency: 'USDT',
    toCurrency: 'NGN',
    amount: '100.00',
    estimatedAmount: '156000.00',
    rate: '1560.00',
  },
};

const CC_SWAP_QUOTATION_EXAMPLE = {
  data: {
    id: 'quo_7f3a1b2c9d0e',
    fromCurrency: 'USDT',
    toCurrency: 'NGN',
    sourceAmount: '100.00',
    targetAmount: '156000.00',
    rate: '1560.00',
    status: 'pending',
    expiresAt: '2026-09-24T12:00:15.000Z',
    createdAt: '2026-09-24T12:00:00.000Z',
  },
};

const CC_SWAP_EXECUTION_EXAMPLE = {
  data: {
    id: 'swp_9a1b2c3d4e5f',
    fromCurrency: 'USDT',
    toCurrency: 'NGN',
    sourceAmount: '100.00',
    targetAmount: '156000.00',
    status: 'completed',
  },
};

const SWAP_RECORD_EXAMPLE = {
  id: '6a0ce75269321c4cb5eafe7d',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  cc_swap_id: 'swp_9a1b2c3d4e5f',
  from_currency: 'USDT',
  to_currency: 'NGN',
  source_amount: 100,
  target_amount: 156000,
  status: 'completed',
  type: 'manual',
  metadata: {},
  created_at: '2026-09-24T12:00:00.000Z',
  updated_at: '2026-09-24T12:00:00.000Z',
};

@ApiTags('Swaps')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('swaps')
export class SwapsController {
  constructor(private readonly swapsService: SwapsService) {}

  @ApiOperation({
    summary: 'Estimate swap amount',
    description: 'Get a live rate estimate without locking the rate.',
  })
  @ApiOkResponse({
    description: 'Swap estimate retrieved successfully.',
    schema: { example: CC_SWAP_ESTIMATE_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message:
        'fromCurrency must be one of the following values: NGN, USDT, USDC, ETH, BNB, SOL, TRX',
    },
    401,
  )
  @Get('estimate')
  estimate(@GetMode() mode: 'live' | 'test', @Query() dto: EstimateSwapDto) {
    return this.swapsService.estimate(mode, dto);
  }

  @ApiOperation({
    summary: 'Create swap quotation',
    description:
      'Lock the current rate for 15 seconds. Execute before it expires.',
  })
  @ApiBody({ type: CreateSwapQuotationDto })
  @ApiCreatedResponse({
    description: 'Swap quotation created successfully.',
    schema: { example: CC_SWAP_QUOTATION_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message:
        'fromCurrency must be one of the following values: NGN, USDT, USDC',
    },
    401,
  )
  @Post('quotation')
  createQuotation(
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateSwapQuotationDto,
  ) {
    return this.swapsService.createQuotation(mode, dto);
  }

  @ApiOperation({ summary: 'Get swap quotation by ID' })
  @ApiParam({ name: 'quotationId', description: 'Quotation ID' })
  @ApiOkResponse({
    description: 'Swap quotation retrieved successfully.',
    schema: { example: CC_SWAP_QUOTATION_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Swap quotation not found or has expired.',
    },
    401,
  )
  @Get('quotation/:quotationId')
  getQuotation(
    @GetMode() mode: 'live' | 'test',
    @Param('quotationId') quotationId: string,
  ) {
    return this.swapsService.getQuotation(mode, quotationId);
  }

  @ApiOperation({
    summary: 'Execute swap quotation',
    description:
      'Execute a locked quotation. Must be done within 15 seconds of creation.',
  })
  @ApiParam({ name: 'quotationId', description: 'Quotation ID to execute' })
  @ApiCreatedResponse({
    description: 'Swap executed successfully.',
    schema: { example: CC_SWAP_EXECUTION_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message:
        'Swap quotation has expired. Create a new quotation and execute within 15 seconds.',
    },
    401,
    {
      status: 403,
      message:
        'This action requires a verified identity. Complete individual KYC verification first.',
    },
  )
  @UseGuards(KycVerifiedGuard)
  @Post('quotation/:quotationId/execute')
  executeQuotation(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('quotationId') quotationId: string,
  ) {
    return this.swapsService.executeQuotation(businessId, mode, quotationId);
  }

  @ApiOperation({ summary: 'List swap history' })
  @ApiOkResponse({
    description: 'Swap history retrieved successfully.',
    schema: {
      example: {
        data: [SWAP_RECORD_EXAMPLE],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    },
  })
  @ApiErrorResponses(401)
  @Get()
  list(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: SwapQueryDto,
  ) {
    return this.swapsService.list(businessId, mode, query);
  }

  @ApiOperation({ summary: 'Get swap details by ID' })
  @ApiParam({ name: 'id', description: 'Swap ID' })
  @ApiOkResponse({
    description: 'Swap retrieved successfully.',
    type: SwapRecord,
    example: SWAP_RECORD_EXAMPLE,
  })
  @ApiErrorResponses(401, { status: 404, message: 'Swap not found.' })
  @Get(':id')
  findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('id') id: string,
  ) {
    return this.swapsService.findOne(businessId, mode, id);
  }
}
