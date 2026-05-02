import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WebhooksController,
  IncomingWebhooksController,
} from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { BreetWebhooksService } from './breet-webhooks.service';
import {
  WebhookEndpoint,
  WebhookEvent,
  LedgerEntry,
  Wallet,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEndpoint,
      WebhookEvent,
      LedgerEntry,
      Wallet,
    ]),
  ],
  controllers: [WebhooksController, IncomingWebhooksController],
  providers: [WebhooksService, BreetWebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
