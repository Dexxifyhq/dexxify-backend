import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CoincircuitWebhooksService } from './coincircuit-webhooks.service';
import { CreateWebhookDto } from './dto';
import {
  GetBusinessId,
  GetMode,
  Public,
  DualAuth,
} from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiBody,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';

@ApiTags('Webhooks')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({ summary: 'Create webhook endpoint' })
  @ApiBody({ type: CreateWebhookDto })
  @Post()
  async create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List webhook endpoints' })
  @Get()
  async findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.webhooksService.findAll(businessId, mode);
  }

  @ApiOperation({ summary: 'Delete webhook endpoint' })
  @ApiParam({ name: 'id', description: 'Webhook endpoint ID' })
  @Delete(':id')
  async remove(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.remove(businessId, mode, id);
  }
}

@ApiTags('Incoming Webhooks')
@Controller('webhooks/incoming')
export class IncomingWebhooksController {
  private readonly logger = new Logger(IncomingWebhooksController.name);

  constructor(private readonly ccWebhooksService: CoincircuitWebhooksService) {}

  @ApiOperation({
    summary: 'Handle Coincircuit webhooks',
    description:
      'Receives deposit, payment, and payout events from CoincircuitMCP. Verified via HMAC-SHA256 signature.',
  })
  @ApiHeader({
    name: 'x-coincircuit-signature',
    description: 'HMAC-SHA256 signature — format: v1=<hex>',
    required: true,
  })
  @ApiHeader({
    name: 'x-coincircuit-timestamp',
    description: 'Unix timestamp used in signature construction',
    required: true,
  })
  @Public()
  @Post('coincircuit')
  @HttpCode(200)
  async handleCoincircuit(@Body() body: any, @Req() req: Request) {
    const verification = this.ccWebhooksService.verifyWebhookRequest(req);
    if (!verification.isValid) {
      this.logger.warn(`CC webhook verification failed: ${verification.error}`);
      return { received: false, error: verification.error };
    }

    const event = body.event;
    this.logger.log(`CC webhook received: ${event}`);

    setImmediate(async () => {
      try {
        await this.ccWebhooksService.processWebhook(body);
        this.logger.log(`CC webhook processed: ${event}`);
      } catch (error: any) {
        this.logger.error(`CC webhook processing failed: ${error.message}`);
      }
    });

    return { received: true, event };
  }
}
