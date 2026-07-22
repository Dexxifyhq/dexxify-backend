import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WebhooksController,
  IncomingWebhooksController,
} from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { CoincircuitWebhooksService } from './coincircuit-webhooks.service';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';
import {
  WebhookEndpoint,
  WebhookEvent,
  PaymentSession,
  Payout,
  LedgerEntry,
  Invoice,
  DepositAccount,
  SwapRecord,
  CryptoTransaction,
} from '../../database/entities';

@Module({
  imports: [
    CoincircuitModule,
    TypeOrmModule.forFeature([
      WebhookEndpoint,
      WebhookEvent,
      PaymentSession,
      Payout,
      LedgerEntry,
      Invoice,
      DepositAccount,
      SwapRecord,
      CryptoTransaction,
    ]),
  ],
  controllers: [WebhooksController, IncomingWebhooksController],
  providers: [WebhooksService, CoincircuitWebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
