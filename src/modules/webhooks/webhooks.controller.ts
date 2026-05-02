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
  Logger,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { BreetWebhooksService } from './breet-webhooks.service';
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
import type { Request } from 'express';

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
  private readonly logger = new Logger(IncomingWebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly breetWebhooksService: BreetWebhooksService,
  ) {}

  @ApiOperation({
    summary: 'Handle Breet webhooks',
    description:
      'Receive webhook events from Breet (deposits, withdrawals). IP whitelisted and secret verified.',
  })
  @ApiHeader({
    name: 'x-webhook-secret',
    description: 'Breet webhook secret for verification',
  })
  @Public()
  @Post('breet')
  @HttpCode(200)
  async handleBreet(
    @Body() body: any,
    @Headers('x-webhook-secret') secret: string,
    @Req() req: Request,
  ) {
    // Verify webhook request (IP + secret)
    const verification = this.breetWebhooksService.verifyWebhookRequest(req);
    if (!verification.isValid) {
      this.logger.warn(`Webhook verification failed: ${verification.error}`);
      return { received: false, error: verification.error };
    }

    // Extract client IP
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      '';

    // Respond immediately to Breet
    const eventId = body.id;
    this.logger.log(`Webhook received: ${eventId}, processing asynchronously`);

    // Process asynchronously (fire and forget)
    setImmediate(async () => {
      try {
        const result = await this.breetWebhooksService.processWebhook(body, ip);
        this.logger.log(`Webhook processed successfully: ${result.eventId}`);
      } catch (error: any) {
        this.logger.error(`Webhook processing failed: ${error.message}`);
      }
    });

    return { received: true, eventId };
  }

  // @ApiOperation({
  //   summary: 'Handle Kora webhooks',
  //   description:
  //     'Receive webhook events from Kora (KYC verification). Signature verified automatically.',
  // })
  // @ApiHeader({
  //   name: 'x-korapay-signature',
  //   description: 'Kora webhook signature for verification',
  // })
  // @Public()
  // @Post('kora')
  // @HttpCode(200)
  // async handleKora(
  //   @Body() body: any,
  //   @Headers('x-korapay-signature') signature: string,
  // ) {
  //   // TODO: Verify Kora webhook signature
  //   // TODO: Route events:
  //   //   - identity.verified → update KYC status, dispatch kyc.approved
  //   //   - identity.failed → update KYC status, dispatch kyc.failed
  //   // TODO: Dispatch to developer webhooks via webhooksService.dispatch()
  //   return { received: true };
  // }
}
