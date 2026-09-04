import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  WebhookEndpoint,
  WebhookEvent,
  WebhookEventStatus,
} from '../../database/entities';
import {
  ListWebhookEventsQueryDto,
  SaveWebhookDto,
  WebhookEventType,
} from './dto';
import { buildPaginationMeta, signWebhookPayload } from '../../common/utils';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpointRepo: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookEvent)
    private readonly eventRepo: Repository<WebhookEvent>,
    private readonly config: ConfigService,
  ) {
    this.retryAttempts = this.config.get<number>('webhook.retryAttempts') || 3;
    this.retryDelay = this.config.get<number>('webhook.retryDelayMs') || 5000;
  }

  async findOne(businessId: string, mode: 'live' | 'test') {
    const endpoint = await this.endpointRepo.findOne({
      where: { business_id: businessId, mode },
    });

    if (!endpoint) {
      return {
        configured: false,
        id: null,
        url: null,
        secret: null,
        is_active: false,
        created_at: null,
        updated_at: null,
      };
    }

    return {
      configured: true,
      id: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      is_active: endpoint.is_active,
      created_at: endpoint.created_at,
      updated_at: endpoint.updated_at,
    };
  }

  /** Create-or-update the single webhook endpoint for a business + mode. */
  async upsert(businessId: string, mode: 'live' | 'test', dto: SaveWebhookDto) {
    const existing = await this.endpointRepo.findOne({
      where: { business_id: businessId, mode },
    });

    if (existing) {
      if (dto.url !== undefined) existing.url = dto.url;
      if (dto.is_active !== undefined) existing.is_active = dto.is_active;
      const saved = await this.endpointRepo.save(existing);
      return {
        configured: true,
        id: saved.id,
        url: saved.url,
        secret: saved.secret,
        is_active: saved.is_active,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
      };
    }

    if (!dto.url) {
      throw new BadRequestException(
        'url is required to create a webhook endpoint.',
      );
    }

    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    const endpoint = this.endpointRepo.create({
      business_id: businessId,
      mode,
      url: dto.url,
      secret,
      is_active: dto.is_active ?? true,
    });

    const saved = await this.endpointRepo.save(endpoint);
    return {
      configured: true,
      id: saved.id,
      url: saved.url,
      secret: saved.secret,
      is_active: saved.is_active,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
    };
  }

  async regenerateSecret(businessId: string, mode: 'live' | 'test') {
    const endpoint = await this.endpointRepo.findOne({
      where: { business_id: businessId, mode },
    });

    if (!endpoint) throw new NotFoundException('Webhook endpoint not found.');

    endpoint.secret = `whsec_${randomBytes(24).toString('base64url')}`;
    const saved = await this.endpointRepo.save(endpoint);
    return { id: saved.id, secret: saved.secret };
  }

  async remove(businessId: string, mode: 'live' | 'test') {
    const endpoint = await this.endpointRepo.findOne({
      where: { business_id: businessId, mode },
    });

    if (!endpoint) throw new NotFoundException('Webhook endpoint not found.');

    await this.endpointRepo.remove(endpoint);
    return { deleted: true };
  }

  /** Paginated delivery log for the business's webhook endpoint in the given mode. */
  async findEvents(
    businessId: string,
    mode: 'live' | 'test',
    query: ListWebhookEventsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const endpoint = await this.endpointRepo.findOne({
      where: { business_id: businessId, mode },
      select: ['id'],
    });

    if (!endpoint) {
      return { data: [], total: 0, page, limit };
    }

    const [data, total] = await this.eventRepo.findAndCount({
      where: {
        webhook_endpoint_id: endpoint.id,
        ...(query.status ? { status: query.status } : {}),
      },
      select: [
        'id',
        'event_type',
        'status',
        'attempts',
        'response_status',
        'last_attempt_at',
        'next_retry_at',
        'delivered_at',
        'created_at',
      ],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  /** A single delivery record, including its full payload and response body. */
  async findEvent(businessId: string, mode: 'live' | 'test', eventId: string) {
    const endpoint = await this.endpointRepo.findOne({
      where: { business_id: businessId, mode },
      select: ['id'],
    });
    if (!endpoint) throw new NotFoundException('Webhook event not found.');

    const event = await this.eventRepo.findOne({
      where: { id: eventId, webhook_endpoint_id: endpoint.id },
    });
    if (!event) throw new NotFoundException('Webhook event not found.');

    return event;
  }

  /** Dispatch an event to the business's webhook endpoint for the given mode */
  async dispatch(
    businessId: string,
    mode: 'live' | 'test',
    eventType: WebhookEventType,
    payload: Record<string, any>,
  ) {
    const endpoints = await this.endpointRepo.find({
      where: {
        business_id: businessId,
        mode,
        is_active: true,
      },
    });

    for (const endpoint of endpoints) {
      const eventPayload = {
        event: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
        webhook_id: endpoint.id,
      };

      const event = this.eventRepo.create({
        webhook_endpoint_id: endpoint.id,
        business_id: businessId,
        event_type: eventType,
        payload: eventPayload,
        status: WebhookEventStatus.PENDING,
      });

      const savedEvent = await this.eventRepo.save(event);

      // In production, queue this via BullMQ
      void this.deliverWebhook(endpoint, savedEvent, eventPayload);
    }
  }

  private async deliverWebhook(
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
    payload: Record<string, any>,
  ) {
    const payloadStr = JSON.stringify(payload);
    const signature = signWebhookPayload(payloadStr, endpoint.secret);

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Dexxify-Signature': signature,
            'X-Dexxify-Event': payload.event as string,
            'X-Dexxify-Delivery': event.id,
          },
          body: payloadStr,
          signal: AbortSignal.timeout(10000),
        });

        await this.eventRepo.update(event.id, {
          status: response.ok
            ? WebhookEventStatus.DELIVERED
            : WebhookEventStatus.FAILED,
          attempts: attempt,
          last_attempt_at: new Date(),
          response_status: response.status,
          delivered_at: response.ok ? new Date() : undefined,
        });

        if (response.ok) {
          this.logger.log(`Webhook delivered: ${event.id} → ${endpoint.url}`);
          return;
        }

        this.logger.warn(
          `Webhook delivery failed (attempt ${attempt}): ${response.status}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Webhook delivery error (attempt ${attempt}): ${message}`,
        );

        await this.eventRepo.update(event.id, {
          attempts: attempt,
          last_attempt_at: new Date(),
          status:
            attempt >= this.retryAttempts
              ? WebhookEventStatus.FAILED
              : WebhookEventStatus.PENDING,
          next_retry_at:
            attempt < this.retryAttempts
              ? new Date(Date.now() + this.retryDelay * attempt)
              : undefined,
        });
      }

      if (attempt < this.retryAttempts) {
        await new Promise((r) => setTimeout(r, this.retryDelay * attempt));
      }
    }
  }
}
