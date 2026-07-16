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
import { GetDeveloper, Public, DualAuth } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import type { Request } from 'express';

@ApiTags('Webhooks')
@DualAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({ summary: 'Create webhook endpoint' })
  @ApiBody({ type: CreateWebhookDto })
  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(developerId, dto);
  }

  @ApiOperation({ summary: 'List webhook endpoints' })
  @Get()
  async findAll(@GetDeveloper('id') developerId: string) {
    return this.webhooksService.findAll(developerId);
  }

  @ApiOperation({ summary: 'Delete webhook endpoint' })
  @ApiParam({ name: 'id', description: 'Webhook endpoint ID' })
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
    private readonly ccWebhooksService: CoincircuitWebhooksService,
  ) {}

  @ApiOperation({
    summary: 'Handle CoincircuitMCP webhooks',
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
