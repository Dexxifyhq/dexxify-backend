import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CoincircuitWebhooksService } from './coincircuit-webhooks.service';
import type { CCWebhookPayload } from './coincircuit-webhooks.service';
import { ListWebhookEventsQueryDto, SaveWebhookDto } from './dto';
import {
  GetBusinessId,
  GetMode,
  Public,
  DualAuth,
} from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiHeader,
  ApiParam,
  ApiBearerAuth,
  ApiOkResponse,
  ApiExcludeController,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Webhooks')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({ summary: 'Get the webhook endpoint for the current mode' })
  @ApiOkResponse({ description: 'Webhook endpoint retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get()
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.webhooksService.findOne(businessId, mode);
  }

  @ApiOperation({
    summary: 'Create or update the webhook endpoint for the current mode',
  })
  @ApiBody({ type: SaveWebhookDto })
  @ApiOkResponse({ description: 'Webhook endpoint saved successfully.' })
  @ApiErrorResponses(400, 401)
  @Put()
  async upsert(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: SaveWebhookDto,
  ) {
    return this.webhooksService.upsert(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'Regenerate the webhook signing secret' })
  @ApiOkResponse({
    description: 'Webhook signing secret regenerated successfully.',
  })
  @ApiErrorResponses(401, 404)
  @ApiExcludeEndpoint()
  @Post('regenerate-secret')
  async regenerateSecret(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.webhooksService.regenerateSecret(businessId, mode);
  }

  @ApiOperation({ summary: 'Delete the webhook endpoint for the current mode' })
  @ApiOkResponse({ description: 'Webhook endpoint deleted successfully.' })
  @ApiErrorResponses(401, 404)
  @Delete()
  async remove(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.webhooksService.remove(businessId, mode);
  }

  @ApiOperation({
    summary: 'List webhook delivery events for the current mode',
  })
  @ApiOkResponse({ description: 'Webhook events retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('events')
  async findEvents(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: ListWebhookEventsQueryDto,
  ) {
    return this.webhooksService.findEvents(businessId, mode, query);
  }

  @ApiOperation({ summary: 'Get a single webhook delivery event' })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  @ApiOkResponse({ description: 'Webhook event retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get('events/:id')
  async findEvent(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.findEvent(businessId, mode, id);
  }
}

@ApiTags('Incoming Webhooks')
@ApiExcludeController()
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
  @ApiOkResponse({
    description:
      'Webhook acknowledged. Always returns 200 — signature verification failures are reported in the response body (`received: false`) rather than as an HTTP error.',
  })
  @Public()
  @Post('coincircuit')
  @HttpCode(200)
  handleCoincircuit(@Body() body: CCWebhookPayload, @Req() req: Request) {
    const verification = this.ccWebhooksService.verifyWebhookRequest(req);
    if (!verification.isValid) {
      this.logger.warn(`CC webhook verification failed: ${verification.error}`);
      return { received: false, error: verification.error };
    }

    const event = body.event;
    this.logger.log(`CC webhook received: ${event}`);

    setImmediate(() => {
      void (async () => {
        try {
          await this.ccWebhooksService.processWebhook(body);
          this.logger.log(`CC webhook processed: ${event}`);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`CC webhook processing failed: ${message}`);
        }
      })();
    });

    return { received: true, event };
  }
}
