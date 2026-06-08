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
import { CreatePaymentSessionDto, PaymentSessionQueryDto } from './dto';
import { GetDeveloper, Public } from '../../common/decorators';

@ApiTags('Payment Sessions')
@ApiBearerAuth('api-key')
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
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreatePaymentSessionDto,
  ) {
    return this.sessionsService.create(developerId, dto);
  }

  @ApiOperation({ summary: 'List payment sessions' })
  @Get()
  findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: PaymentSessionQueryDto,
  ) {
    return this.sessionsService.findAll(developerId, query);
  }

  @Public()
  @ApiOperation({ summary: 'Get a payment session by ID' })
  @ApiParam({ name: 'session_id', description: 'Payment session UUID' })
  @Get(':session_id')
  findOne(
    // @GetDeveloper('id') developerId: string,
    @Param('session_id', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessionsService.findOne(sessionId);
  }

  @ApiOperation({ summary: 'Get a payment session by reference' })
  @ApiParam({ name: 'reference', description: 'Session reference (ps_...)' })
  @Get('ref/:reference')
  findByReference(
    @GetDeveloper('id') developerId: string,
    @Param('reference') reference: string,
  ) {
    return this.sessionsService.findByReference(developerId, reference);
  }

  @ApiOperation({ summary: 'Cancel a pending payment session' })
  @ApiParam({ name: 'session_id', description: 'Payment session UUID' })
  @HttpCode(HttpStatus.OK)
  @Post(':session_id/cancel')
  cancel(@Param('session_id', ParseUUIDPipe) sessionId: string) {
    return this.sessionsService.cancel(sessionId);
  }
}
