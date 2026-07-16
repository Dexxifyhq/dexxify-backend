import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const WEBHOOK_EVENT_TYPES = [
  'wallet.deposit.confirmed',
  'offramp.completed',
  'offramp.failed',
  'payout.success',
  'payout.failed',
  'kyc.approved',
  'kyc.failed',
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
    example: ['wallet.deposit.confirmed', 'offramp.completed'],
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
    example: ['wallet.deposit.confirmed', 'offramp.completed'],
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
