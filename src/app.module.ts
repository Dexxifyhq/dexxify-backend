import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

// Config
import configuration from './config/configuration';

// Database
import { DatabaseModule } from './database/database.module';
import { ApiKey, Business, User, BusinessUser } from './database/entities';

// Common
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { RedisModule } from './common/redis/redis.module';

// Feature modules
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { OfframpModule } from './modules/offramp/offramp.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { KycModule } from './modules/kyc/kyc.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MiscModule } from './modules/misc/misc.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PaymentSessionsModule } from './modules/payment-sessions/payment-sessions.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentPagesModule } from './modules/payment-pages/payment-pages.module';
import { SwapsModule } from './modules/swaps/swaps.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AdminModule } from './modules/admin/admin.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DevelopersModule } from './modules/developers/developers.module';
import { CustomThrottlerGuard } from './common/guards/throttle.guards';
import { ThrottlerRedisService } from './common/services/throttler-redis.service';

@Module({
  imports: [
    // Config — flat style
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env.local',
    }),

    // Rate Limiting Configuration with Redis
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const storage = new ThrottlerRedisService();

        return {
          throttlers: [
            {
              name: 'global',
              ttl: 300000, // 5 minutes in milliseconds
              limit: 100, // 100 requests
            },
          ],
          storage,
        };
      },
    }),

    // Redis — token blocklist, future caching/rate-limit storage
    RedisModule,

    // Database — TypeORM + Postgres (provider-agnostic)
    DatabaseModule,

    // Entities needed by the global ApiKeyGuard
    TypeOrmModule.forFeature([ApiKey, User, Business, BusinessUser]),

    // Feature modules
    MailModule,
    AuthModule,
    WalletsModule,
    OfframpModule,
    PayoutsModule,
    KycModule,
    WebhooksModule,
    LedgerModule,
    DashboardModule,
    MiscModule,
    CustomersModule,
    PaymentSessionsModule,
    InvoicesModule,
    PaymentPagesModule,
    SwapsModule,
    RefundsModule,
    PlatformModule,
    AdminModule,
    BusinessesModule,
    TeamsModule,
    DevelopersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
