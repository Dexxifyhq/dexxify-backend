import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  WebhookEndpoint,
  WebhookEvent,
  WebhookEventStatus,
} from '../../database/entities';
import { CreateWebhookDto, WebhookEventType } from './dto';
import { signWebhookPayload } from '../../common/utils';

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

  async create(developerId: string, dto: CreateWebhookDto) {
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;

    const endpoint = this.endpointRepo.create({
      developer_id: developerId,
      url: dto.url,
      secret,
      events: dto.events,
      description: dto.description,
    });

    const saved = await this.endpointRepo.save(endpoint);
    return { ...saved, secret }; // Show secret only on creation
  }

  async findAll(developerId: string) {
    return this.endpointRepo.find({
      where: { developer_id: developerId },
      select: [
        'id',
        'url',
        'events',
        'is_active',
        'description',
        'created_at',
        'updated_at',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async remove(developerId: string, webhookId: string) {
    const endpoint = await this.endpointRepo.findOne({
      where: { id: webhookId, developer_id: developerId },
    });

    if (!endpoint) throw new NotFoundException('Webhook endpoint not found.');

    await this.endpointRepo.remove(endpoint);
    return { deleted: true, id: webhookId };
  }

  /** Dispatch an event to all matching webhook endpoints for a developer */
  async dispatch(
    developerId: string,
    eventType: WebhookEventType,
    payload: Record<string, any>,
  ) {
    const endpoints = await this.endpointRepo.find({
      where: {
        developer_id: developerId,
        is_active: true,
      },
    });

    // Filter endpoints subscribed to this event type
    const matching = endpoints.filter(
      (ep) => ep.events.includes(eventType) || ep.events.includes('*'),
    );

    if (!matching.length) {
      this.logger.debug(
        `No webhook endpoints for ${eventType} (dev: ${developerId})`,
      );
      return;
    }

    for (const endpoint of matching) {
      const eventPayload = {
        event: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
        webhook_id: endpoint.id,
      };

      const event = this.eventRepo.create({
        webhook_endpoint_id: endpoint.id,
        developer_id: developerId,
        event_type: eventType,
        payload: eventPayload,
        status: WebhookEventStatus.PENDING,
      });

      const savedEvent = await this.eventRepo.save(event);

      // In production, queue this via BullMQ
      this.deliverWebhook(endpoint, savedEvent, eventPayload);
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
      } catch (err: any) {
        this.logger.error(
          `Webhook delivery error (attempt ${attempt}): ${err.message}`,
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
