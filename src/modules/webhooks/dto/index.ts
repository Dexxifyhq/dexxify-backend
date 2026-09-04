import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEventStatus } from '../../../database/entities';

export const WEBHOOK_EVENT_TYPES = [
  'payment.completed',
  'payment.partial',
  'payment.expired',
  'payment.failed',
  'transaction.received',
  'transaction.confirmed',
  'deposit.processing',
  'deposit.confirmed',
  'deposit.failed',
  'swap.completed',
  'swap.failed',
  'offramp.processing',
  'offramp.completed',
  'offramp.failed',
  'payout.created',
  'payout.success',
  'payout.failed',
  'refund.created',
  'refund.success',
  'refund.failed',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export class SaveWebhookDto {
  @ApiPropertyOptional({
    description: 'Webhook URL',
    example: 'https://example.com/webhook',
  })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Whether the webhook endpoint is enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ListWebhookEventsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: WebhookEventStatus,
  })
  @IsOptional()
  @IsEnum(WebhookEventStatus)
  status?: WebhookEventStatus;
}
