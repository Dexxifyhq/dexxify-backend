import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Webhook URL',
    example: 'https://example.com/webhook',
  })
  @IsUrl()
  url: string;

  @ApiProperty({
    description: 'Array of webhook events',
    example: ['deposit.confirmed', 'offramp.completed'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({
    description: 'Webhook description',
    example: 'Webhook for wallet and offramp events',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional({
    description: 'Webhook URL',
    example: 'https://example.com/webhook',
  })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Array of webhook events',
    example: ['deposit.confirmed', 'offramp.completed'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({
    description: 'Webhook description',
    example: 'Updated webhook description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
