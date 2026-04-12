import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  RawBodyRequest,
  Req,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto';
import { GetDeveloper, Public } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';

@ApiTags('Webhooks')
@ApiBearerAuth('api-key')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({
    summary: 'Create webhook endpoint',
    description:
      'Register a new webhook endpoint to receive event notifications',
  })
  @ApiBody({ type: CreateWebhookDto })
  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(developerId, dto);
  }

  @ApiOperation({
    summary: 'List webhook endpoints',
    description: 'Retrieve all registered webhook endpoints for the developer',
  })
  @Get()
  async findAll(@GetDeveloper('id') developerId: string) {
    return this.webhooksService.findAll(developerId);
  }

  @ApiOperation({
    summary: 'Delete webhook endpoint',
    description: 'Remove a registered webhook endpoint by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook endpoint unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Delete(':id')
  async remove(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.remove(developerId, id);
  }
}

@ApiTags('Incoming Webhooks')
@Controller('webhooks/incoming')
export class IncomingWebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({
    summary: 'Handle Breet webhooks',
    description:
      'Receive webhook events from Breet (deposits, offramps, payouts). Signature verified automatically.',
  })
  @ApiHeader({
    name: 'x-breet-signature',
    description: 'Breet webhook signature for verification',
  })
  @Public()
  @Post('breet')
  @HttpCode(200)
  async handleBreet(
    @Body() body: any,
    @Headers('x-breet-signature') signature: string,
  ) {
    // TODO: Verify Breet webhook signature
    // TODO: Route events:
    //   - wallet.deposit → credit wallet balance, dispatch wallet.deposit.confirmed
    //   - offramp.completed → update offramp tx, dispatch offramp.completed
    //   - payout.success → update payout status, dispatch payout.success
    //   - payout.failed → update payout status, dispatch payout.failed
    //   - onramp.completed → credit wallet, dispatch onramp.completed
    // TODO: Dispatch to developer webhooks via webhooksService.dispatch()
    return { received: true };
  }

  @ApiOperation({
    summary: 'Handle Kora webhooks',
    description:
      'Receive webhook events from Kora (KYC verification). Signature verified automatically.',
  })
  @ApiHeader({
    name: 'x-korapay-signature',
    description: 'Kora webhook signature for verification',
  })
  @Public()
  @Post('kora')
  @HttpCode(200)
  async handleKora(
    @Body() body: any,
    @Headers('x-korapay-signature') signature: string,
  ) {
    // TODO: Verify Kora webhook signature
    // TODO: Route events:
    //   - identity.verified → update KYC status, dispatch kyc.approved
    //   - identity.failed → update KYC status, dispatch kyc.failed
    // TODO: Dispatch to developer webhooks via webhooksService.dispatch()
    return { received: true };
  }
}
