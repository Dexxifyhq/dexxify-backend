import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisConfig } from '../utils/redisConfig';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        return new Redis({
          ...getRedisConfig(),
          maxRetriesPerRequest: 3,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
