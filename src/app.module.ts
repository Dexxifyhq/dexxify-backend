import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Config
import configuration from './config/configuration';

// Database
import { DatabaseModule } from './database/database.module';
import { ApiKey, Developer } from './database/entities';

// Common
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ApiKeyGuard } from './common/guards/api-key.guard';

// Feature modules
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { OfframpModule } from './modules/offramp/offramp.module';
import { OnrampModule } from './modules/onramp/onramp.module';
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

@Module({
  imports: [
    // Config — flat style
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env.local',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      },
    ]),

    // Database — TypeORM + Postgres (provider-agnostic)
    DatabaseModule,

    // Entities needed by the global ApiKeyGuard
    TypeOrmModule.forFeature([ApiKey, Developer]),

    // Feature modules
    MailModule,
    AuthModule,
    WalletsModule,
    OfframpModule,
    OnrampModule,
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
