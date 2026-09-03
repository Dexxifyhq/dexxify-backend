import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

interface SessionRecord {
  accessJti: string;
  refreshJti: string;
  issuedAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
}

export interface SessionSummary {
  session_id: string;
  issued_at: string;
  expires_at: string;
  ip?: string;
  user_agent?: string;
  current: boolean;
}

@Injectable()
export class TokenBlocklistService {
  private readonly logger = new Logger(TokenBlocklistService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(jti: string): string {
    return `blocklist:jti:${jti}`;
  }

  private sessionsKey(userId: string): string {
    return `user:${userId}:sessions`;
  }

  /** Block a token's jti until it would have expired anyway — no point keeping it longer. */
  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await this.redis.set(this.key(jti), '1', 'EX', ttlSeconds);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to revoke token ${jti}: ${message}`);
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(this.key(jti));
      return exists === 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to check revocation for ${jti}: ${message}`);
      // Redis being down shouldn't lock every user out — fail open on the
      // blocklist check itself (the DB active-status check still applies).
      return false;
    }
  }

  async trackSession(
    userId: string,
    sessionId: string,
    session: Omit<SessionRecord, 'expiresAt'> & {
      accessExpiresAt: number;
      refreshExpiresAt: number;
    },
  ): Promise<void> {
    const key = this.sessionsKey(userId);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.refreshExpiresAt;
    const ttl = expiresAt - now;
    if (ttl <= 0) return;

    const record: SessionRecord = {
      accessJti: session.accessJti,
      refreshJti: session.refreshJti,
      issuedAt: session.issuedAt,
      expiresAt,
      ip: session.ip,
      userAgent: session.userAgent,
    };

    try {
      await this.redis
        .multi()
        .hset(key, sessionId, JSON.stringify(record))
        .expire(key, ttl)
        .exec();
      await this.pruneExpiredSessions(userId, now);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to track session for user ${userId}: ${message}`,
      );
    }
  }

  /** Drop any session records whose refresh token has already expired. */
  private async pruneExpiredSessions(
    userId: string,
    now: number,
  ): Promise<void> {
    const key = this.sessionsKey(userId);
    const all = await this.redis.hgetall(key);
    const expiredFields = Object.entries(all)
      .filter(([, raw]) => {
        try {
          return (JSON.parse(raw) as SessionRecord).expiresAt <= now;
        } catch {
          return true; // unparseable — drop it
        }
      })
      .map(([field]) => field);

    if (expiredFields.length > 0) {
      await this.redis.hdel(key, ...expiredFields);
    }
  }

  /** List every still-live session for this user, newest first. */
  async listSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionSummary[]> {
    const key = this.sessionsKey(userId);
    const now = Math.floor(Date.now() / 1000);

    try {
      const all = await this.redis.hgetall(key);
      const sessions: SessionSummary[] = [];

      for (const [sessionId, raw] of Object.entries(all)) {
        let record: SessionRecord;
        try {
          record = JSON.parse(raw) as SessionRecord;
        } catch {
          continue;
        }
        if (record.expiresAt <= now) continue;

        sessions.push({
          session_id: sessionId,
          issued_at: new Date(record.issuedAt * 1000).toISOString(),
          expires_at: new Date(record.expiresAt * 1000).toISOString(),
          ip: record.ip,
          user_agent: record.userAgent,
          current: sessionId === currentSessionId,
        });
      }

      return sessions.sort((a, b) => (a.issued_at < b.issued_at ? 1 : -1));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to list sessions for ${userId}: ${message}`);
      return [];
    }
  }

  /** Revoke one specific session (both its access and refresh jti). */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const key = this.sessionsKey(userId);
    const now = Math.floor(Date.now() / 1000);

    try {
      const raw = await this.redis.hget(key, sessionId);
      if (!raw) return false;

      const record = JSON.parse(raw) as SessionRecord;
      await Promise.all([
        this.revoke(record.accessJti, record.expiresAt - now),
        this.revoke(record.refreshJti, record.expiresAt - now),
      ]);
      await this.redis.hdel(key, sessionId);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to revoke session ${sessionId} for ${userId}: ${message}`,
      );
      return false;
    }
  }

  /** Revoke every still-live session this user currently has. */
  async revokeAllForUser(userId: string): Promise<number> {
    const key = this.sessionsKey(userId);
    const now = Math.floor(Date.now() / 1000);

    try {
      const all = await this.redis.hgetall(key);
      const pipeline = this.redis.pipeline();
      let revokedCount = 0;

      for (const raw of Object.values(all)) {
        let record: SessionRecord;
        try {
          record = JSON.parse(raw) as SessionRecord;
        } catch {
          continue;
        }
        const ttl = record.expiresAt - now;
        if (ttl <= 0) continue;

        pipeline.set(this.key(record.accessJti), '1', 'EX', ttl);
        pipeline.set(this.key(record.refreshJti), '1', 'EX', ttl);
        revokedCount++;
      }

      if (revokedCount > 0) await pipeline.exec();
      await this.redis.del(key);

      return revokedCount;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to revoke all sessions for ${userId}: ${message}`,
      );
      return 0;
    }
  }
}
