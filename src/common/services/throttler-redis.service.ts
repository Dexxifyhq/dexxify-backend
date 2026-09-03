import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { Redis } from 'ioredis';
import { getRedisConfig } from '../utils/redisConfig';

@Injectable()
export class ThrottlerRedisService implements ThrottlerStorage, OnModuleInit {
  private redis: Redis;
  private readonly logger = new Logger(ThrottlerRedisService.name);

  constructor() {
    this.redis = new Redis(getRedisConfig());

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected for throttler');
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready for throttler');
    });
  }

  async onModuleInit() {
    try {
      await this.redis.ping();
      this.logger.log('Redis throttler storage initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // Required by the ThrottlerStorage interface but not needed here — TTL
    // is derived from the key itself via PEXPIRE/PTTL below.
    void blockDuration;
    void throttlerName;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key); // Get remaining TTL

      const results = await pipeline.exec();
      // console.log(results);

      if (!results || results.some(([err]) => err)) {
        this.logger.error('Redis pipeline failed:', results);
        throw new Error('Redis pipeline execution failed');
      }

      const totalHits = results[0][1] as number;
      const remainingTtl = results[1][1] as number;

      // Only set expiry on first hit (when key is brand new)
      if (totalHits === 1) {
        await this.redis.pexpire(key, ttl); // use PEXPIRE to stay in ms
      }

      // If key is new (no TTL), use the provided TTL
      const timeToExpire = remainingTtl > 0 ? remainingTtl : ttl;
      const isBlocked = totalHits > limit;

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? timeToExpire : 0,
      };
    } catch (error) {
      this.logger.error('Failed to increment throttler key:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }
}
