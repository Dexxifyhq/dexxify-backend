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
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { PaymentSessionsService } from './payment-sessions.service';
import {
  CreatePaymentSessionDto,
  GenerateDepositAddressDto,
  EstimatePaymentDto,
  PaymentSessionQueryDto,
} from './dto';
import {
  DualAuth,
  GetBusinessId,
  GetMode,
  Public,
} from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { PaymentSession } from '../../database/entities';

const PAYMENT_SESSION_EXAMPLE = {
  id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  customer_id: '9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e',
  reference: 'ps_4f2a9c1e',
  amount: 50000,
  amount_paid: null,
  currency: 'NGN',
  deposit_address: null,
  crypto_asset: null,
  network: null,
  status: 'pending',
  payment_page_id: null,
  invoice_id: null,
  transaction_id: null,
  provider_session_reference: 'cc_ps_7f3a1b2c',
  metadata: { order_id: 'ord_xyz' },
  expires_at: '2026-09-24T13:00:00.000Z',
  completed_at: null,
  created_at: '2026-09-24T12:00:00.000Z',
  updated_at: '2026-09-24T12:00:00.000Z',
};

const PAYMENT_SESSION_WITH_CUSTOMER_EXAMPLE = {
  ...PAYMENT_SESSION_EXAMPLE,
  customer: {
    id: '9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e',
    business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
    mode: 'test',
    email: 'hansen@gmail.com',
    phone: null,
    first_name: 'Billy',
    last_name: 'James',
    status: 'active',
    cc_customer_id: 'cc_cus_9a1b2c3d',
    metadata: {},
    created_at: '2026-09-24T12:00:00.000Z',
    updated_at: '2026-09-24T12:00:00.000Z',
  },
};

const CC_PAYMENT_ESTIMATE_EXAMPLE = {
  data: {
    asset: 'USDT',
    chain: 'tron',
    amount: '50000',
    currency: 'NGN',
    cryptoAmount: '31.25',
    rate: '1600.00',
    reference: 'cs-abc123',
  },
};

@ApiTags('Payment Sessions')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('payment-sessions')
export class PaymentSessionsController {
  constructor(private readonly sessionsService: PaymentSessionsService) {}

  @ApiOperation({
    summary: 'Create a payment session',
    description:
      'Initialise a payment session for onramp, offramp, or payout. Returns a reference the customer can use to complete payment.',
  })
  @ApiBody({ type: CreatePaymentSessionDto })
  @ApiCreatedResponse({
    description: 'Payment session created successfully.',
    type: PaymentSession,
    example: PAYMENT_SESSION_EXAMPLE,
  })
  @ApiErrorResponses(
    { status: 400, message: 'amount must be a positive number' },
    401,
  )
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreatePaymentSessionDto,
  ) {
    return this.sessionsService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List payment sessions' })
  @ApiOkResponse({
    description: 'Payment sessions retrieved successfully.',
    schema: {
      example: {
        data: [PAYMENT_SESSION_EXAMPLE],
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
    @Query() query: PaymentSessionQueryDto,
  ) {
    return this.sessionsService.findAll(businessId, mode, query);
  }

  @Public()
  @ApiOperation({ summary: 'Get a payment session by ID' })
  @ApiParam({ name: 'session_id', description: 'Payment session UUID' })
  @ApiOkResponse({
    description: 'Payment session retrieved successfully.',
    type: PaymentSession,
    example: PAYMENT_SESSION_WITH_CUSTOMER_EXAMPLE,
  })
  @ApiErrorResponses(
    { status: 400, message: 'Validation failed (uuid is expected)' },
    { status: 404, message: 'Payment session not found.' },
  )
  @Get(':session_id')
  findOne(
    // @GetBusinessId() businessId: string,
    @Param('session_id', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessionsService.findOne(sessionId);
  }

  @ApiOperation({ summary: 'Get a payment session by reference' })
  @ApiParam({ name: 'reference', description: 'Session reference (ps_...)' })
  @ApiOkResponse({
    description: 'Payment session retrieved successfully.',
    schema: {
      example: {
        ...PAYMENT_SESSION_EXAMPLE,
        cc: CC_PAYMENT_ESTIMATE_EXAMPLE.data,
      },
    },
  })
  @ApiErrorResponses(401, {
    status: 404,
    message: 'Payment session not found.',
  })
  @Get('ref/:reference')
  findByReference(
    @GetBusinessId() businessId: string,
    @Param('reference') reference: string,
  ) {
    return this.sessionsService.findByReference(businessId, reference);
  }

  @ApiOperation({
    summary: 'Generate deposit address for a session',
    description:
      'Requests a crypto deposit address from CoincircuitMCP and stores it on the session.',
  })
  @ApiParam({ name: 'session_id', description: 'Payment session UUID' })
  @ApiBody({ type: GenerateDepositAddressDto })
  @ApiCreatedResponse({
    description: 'Deposit address generated successfully.',
    schema: {
      example: {
        session: {
          ...PAYMENT_SESSION_EXAMPLE,
          deposit_address: 'TXkPqR7YbAaHqZ5t5fRZ9Zk3f2NcQvJ9f2A',
          crypto_asset: 'USDT',
          network: 'Tron',
        },
      },
    },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Bad request.',
    },
    401,
    { status: 404, message: 'Payment session not found.' },
  )
  @Post(':session_id/deposit-address')
  generateDepositAddress(
    @Param('session_id', ParseUUIDPipe) sessionId: string,
    @Body() dto: GenerateDepositAddressDto,
  ) {
    return this.sessionsService.generateDepositAddress(sessionId, dto);
  }

  @ApiOperation({
    summary: 'Estimate crypto amount for a fiat payment',
    description:
      'Returns the crypto amount equivalent for a given fiat amount.',
  })
  @ApiBody({ type: EstimatePaymentDto })
  @ApiOkResponse({
    description: 'Payment estimate calculated successfully.',
    schema: { example: CC_PAYMENT_ESTIMATE_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Asset TON is not supported by CoincircuitMCP.',
    },
    401,
  )
  @Post('estimate')
  getEstimate(@Body() dto: EstimatePaymentDto) {
    return this.sessionsService.getEstimate(dto);
  }

  @ApiOperation({ summary: 'Cancel a pending payment session' })
  @ApiParam({ name: 'session_id', description: 'Payment session UUID' })
  @ApiOkResponse({
    description: 'Payment session cancelled successfully.',
    type: PaymentSession,
    example: { ...PAYMENT_SESSION_EXAMPLE, status: 'failed' },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: "Cannot cancel a session with status 'completed'.",
    },
    401,
    { status: 404, message: 'Payment session not found.' },
  )
  @HttpCode(HttpStatus.OK)
  @Post(':session_id/cancel')
  cancel(@Param('session_id', ParseUUIDPipe) sessionId: string) {
    return this.sessionsService.cancel(sessionId);
  }
}
