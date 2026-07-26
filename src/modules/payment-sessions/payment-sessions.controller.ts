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
import { PaymentSessionsService } from './payment-sessions.service';
import {
  CreatePaymentSessionDto,
  GenerateDepositAddressDto,
  EstimatePaymentDto,
  PaymentSessionQueryDto,
} from './dto';
import { DualAuth, GetBusinessId, GetMode, Public } from '../../common/decorators';

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
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreatePaymentSessionDto,
  ) {
    return this.sessionsService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List payment sessions' })
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
  @Get(':session_id')
  findOne(
    // @GetBusinessId() businessId: string,
    @Param('session_id', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessionsService.findOne(sessionId);
  }

  @ApiOperation({ summary: 'Get a payment session by reference' })
  @ApiParam({ name: 'reference', description: 'Session reference (ps_...)' })
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
  @Post('estimate')
  getEstimate(@Body() dto: EstimatePaymentDto) {
    return this.sessionsService.getEstimate(dto);
  }

  @ApiOperation({ summary: 'Cancel a pending payment session' })
  @ApiParam({ name: 'session_id', description: 'Payment session UUID' })
  @HttpCode(HttpStatus.OK)
  @Post(':session_id/cancel')
  cancel(@Param('session_id', ParseUUIDPipe) sessionId: string) {
    return this.sessionsService.cancel(sessionId);
  }
}
