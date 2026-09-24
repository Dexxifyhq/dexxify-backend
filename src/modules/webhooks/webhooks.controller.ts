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

const WEBHOOK_ENDPOINT_EXAMPLE = {
  configured: true,
  id: '6a0ce75269321c4cb5eafe7d',
  url: 'https://example.com/webhooks/dexxify',
  secret: 'whsec_9f3a1b2c9d0e4f5a6b7c8d9e0f1a2b3c',
  is_active: true,
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const WEBHOOK_EVENT_EXAMPLE = {
  id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  event_type: 'payment_session.completed',
  status: 'delivered',
  attempts: 1,
  response_status: 200,
  last_attempt_at: '2026-09-24T12:00:05.000Z',
  next_retry_at: null,
  delivered_at: '2026-09-24T12:00:05.000Z',
  created_at: '2026-09-24T12:00:00.000Z',
};

@ApiTags('Webhooks')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @ApiOperation({ summary: 'Get the webhook endpoint for the current mode' })
  @ApiOkResponse({
    description: 'Webhook endpoint retrieved successfully.',
    schema: { example: WEBHOOK_ENDPOINT_EXAMPLE },
  })
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
  @ApiOkResponse({
    description: 'Webhook endpoint saved successfully.',
    schema: { example: WEBHOOK_ENDPOINT_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'url is required to create a webhook endpoint.',
    },
    401,
  )
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
  @ApiOkResponse({
    description: 'Webhook endpoint deleted successfully.',
    schema: { example: { deleted: true } },
  })
  @ApiErrorResponses(401, {
    status: 404,
    message: 'Webhook endpoint not found.',
  })
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
  @ApiOkResponse({
    description: 'Webhook events retrieved successfully.',
    schema: {
      example: {
        data: [WEBHOOK_EVENT_EXAMPLE],
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
  @ApiOkResponse({
    description: 'Webhook event retrieved successfully.',
    schema: {
      example: {
        ...WEBHOOK_EVENT_EXAMPLE,
        webhook_endpoint_id: '6a0ce75269321c4cb5eafe7d',
        business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
        payload: {
          event: 'payment_session.completed',
          data: { reference: 'ps_4f2a9c1e', status: 'completed' },
          timestamp: '2026-09-24T12:00:00.000Z',
          webhook_id: '6a0ce75269321c4cb5eafe7d',
        },
        response_body: 'OK',
      },
    },
  })
  @ApiErrorResponses(
    { status: 400, message: 'Validation failed (uuid is expected)' },
    401,
    { status: 404, message: 'Webhook event not found.' },
  )
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
