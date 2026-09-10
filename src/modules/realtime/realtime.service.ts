import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  MessageEvent,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Observable, Subject, finalize } from 'rxjs';
import { getRedisConfig } from '../../common/utils/redisConfig';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

const CHANNEL_PREFIX = 'sse:';

interface ChannelSubject {
  subject: Subject<MessageEvent>;
  refCount: number;
}

/**
 * Fans out live event pushes (payment/deposit/payout/etc.) to connected
 * dashboard SSE clients, scoped per business + mode. Backed by Redis
 * pub/sub — not just an in-memory EventEmitter — so an event published
 * from whichever instance handled the triggering webhook still reaches a
 * client whose SSE connection landed on a different instance.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly subscriber: Redis;
  private readonly channels = new Map<string, ChannelSubject>();

  constructor(@Inject(REDIS_CLIENT) private readonly publisher: Redis) {
    this.subscriber = new Redis({
      ...getRedisConfig(),
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit() {
    await this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      const entry = this.channels.get(channel);
      if (!entry) return;

      try {
        entry.subject.next(JSON.parse(message) as MessageEvent);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to parse SSE message on ${channel}: ${msg}`);
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }

  private channelKey(businessId: string, mode: 'live' | 'test'): string {
    return `${CHANNEL_PREFIX}${businessId}:${mode}`;
  }

  /** Subscribe a client to live events for a business + mode. */
  subscribe(
    businessId: string,
    mode: 'live' | 'test',
  ): Observable<MessageEvent> {
    const key = this.channelKey(businessId, mode);
    let entry = this.channels.get(key);
    if (!entry) {
      entry = { subject: new Subject<MessageEvent>(), refCount: 0 };
      this.channels.set(key, entry);
    }
    entry.refCount += 1;

    return entry.subject.asObservable().pipe(
      finalize(() => {
        const current = this.channels.get(key);
        if (!current) return;
        current.refCount -= 1;
        if (current.refCount <= 0) this.channels.delete(key);
      }),
    );
  }

  /** Push a live event to every client connected for this business + mode. */
  publish(
    businessId: string,
    mode: 'live' | 'test',
    eventType: string,
    data: Record<string, any>,
  ) {
    const channel = this.channelKey(businessId, mode);
    const message: MessageEvent = { type: eventType, data };

    this.publisher
      .publish(channel, JSON.stringify(message))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to publish SSE event ${eventType}: ${msg}`);
      });
  }
}
