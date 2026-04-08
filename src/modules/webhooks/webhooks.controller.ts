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
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto';
import { GetDeveloper, Public } from '../../common/decorators';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(developerId, dto);
  }

  @Get()
  async findAll(@GetDeveloper('id') developerId: string) {
    return this.webhooksService.findAll(developerId);
  }

  @Delete(':id')
  async remove(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.remove(developerId, id);
  }
}

/**
 * Separate controller for incoming provider webhooks (Breet, Kora).
 * These are public endpoints — verified by signature, not API key.
 */
@Controller('webhooks/incoming')
export class IncomingWebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

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
