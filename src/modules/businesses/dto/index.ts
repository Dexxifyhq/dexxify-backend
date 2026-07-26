import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType, PayoutMethod, SettlementCurrency } from '../../../database/entities';

export class CreateBusinessDto {
  @ApiPropertyOptional({ description: 'Business name', example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: BusinessType, example: BusinessType.ECOMMERCE })
  @IsEnum(BusinessType)
  @IsOptional()
  type?: BusinessType;
}

export class UpdateBusinessProfileDto {
  @ApiPropertyOptional({ description: 'Business name', example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: BusinessType, example: BusinessType.ECOMMERCE })
  @IsEnum(BusinessType)
  @IsOptional()
  type?: BusinessType;

  @ApiPropertyOptional({
    description: 'Support email',
    example: 'support@acme.com',
  })
  @IsEmail()
  @IsOptional()
  support_email?: string;

  @ApiPropertyOptional({
    description: 'Logo URL',
    example: 'https://cdn.example.com/logo.png',
  })
  @IsString()
  @IsOptional()
  logo_url?: string;

  @ApiPropertyOptional({
    description: 'Show branding on checkout',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  show_branding_on_checkout?: boolean;

  @ApiPropertyOptional({
    description: 'Business website',
    example: 'https://acme.com',
  })
  @IsString()
  @IsOptional()
  website_url?: string;
}

export class UpdateSettlementsDto {
  @ApiPropertyOptional({
    enum: SettlementCurrency,
    example: SettlementCurrency.USDT,
  })
  @IsEnum(SettlementCurrency)
  @IsOptional()
  settlement_currency?: SettlementCurrency;

  @ApiPropertyOptional({ enum: PayoutMethod, example: PayoutMethod.CRYPTO })
  @IsEnum(PayoutMethod)
  @IsOptional()
  default_payout_method?: PayoutMethod;

  @ApiPropertyOptional({ description: 'Enable instant payouts', example: false })
  @IsBoolean()
  @IsOptional()
  instant_payouts_enabled?: boolean;
}

export class UpdateNotificationsDto {
  @ApiPropertyOptional({
    description: 'Key-value map of notification toggles',
    example: {
      email_notifications: true,
      low_balance_alerts: false,
      automated_receipts: true,
      invoice_followups: true,
    },
  })
  @IsObject()
  @IsOptional()
  preferences?: Record<string, boolean>;
}
