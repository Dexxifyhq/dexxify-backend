import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WebhooksController,
  IncomingWebhooksController,
} from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookEndpoint, WebhookEvent } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEndpoint, WebhookEvent])],
  controllers: [WebhooksController, IncomingWebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
