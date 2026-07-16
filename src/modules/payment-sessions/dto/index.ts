import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  PaymentSessionStatus,
  WalletAsset,
  WalletNetwork,
} from '../../../database/entities';

export class CreatePaymentSessionDto {
  @ApiProperty({ description: 'Amount in the given currency', example: 50000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'ISO currency code', example: 'NGN' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiPropertyOptional({
    description: 'Session title shown on the checkout page',
    example: 'Payment for Order #1234',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Session description shown on the checkout page',
    example: 'Complete your order payment',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Crypto asset (locks asset for this session)',
    enum: WalletAsset,
  })
  @IsOptional()
  @IsEnum(WalletAsset)
  crypto_asset?: WalletAsset;

  @ApiPropertyOptional({
    description: 'Blockchain network (locks chain for this session)',
    enum: WalletNetwork,
  })
  @IsOptional()
  @IsEnum(WalletNetwork)
  network?: WalletNetwork;

  @ApiPropertyOptional({
    description: 'Customer email to link this session to',
    example: 'hansen@gmail.com',
  })
  @IsEmail()
  @IsOptional()
  customer_email?: string;

  @ApiPropertyOptional({
    description: 'Customer first name',
    example: 'Billy',
  })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Customer last name',
    example: 'James',
  })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Minutes until this session expires (default: 30)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expires_in_minutes?: number;

  @ApiPropertyOptional({ description: 'Redirect URL on successful payment' })
  @IsOptional()
  @IsUrl()
  success_url?: string;

  @ApiPropertyOptional({ description: 'Redirect URL on cancelled payment' })
  @IsOptional()
  @IsUrl()
  cancel_url?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary key-value data',
    example: { order_id: 'ord_xyz' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class GenerateDepositAddressDto {
  @ApiProperty({ description: 'Crypto asset to receive', enum: WalletAsset })
  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @ApiProperty({
    description: 'Blockchain network to generate address on',
    enum: WalletNetwork,
  })
  @IsEnum(WalletNetwork)
  network: WalletNetwork;
}

export class EstimatePaymentDto {
  @ApiProperty({ description: 'Crypto asset', enum: WalletAsset })
  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @ApiProperty({ description: 'Blockchain network', enum: WalletNetwork })
  @IsEnum(WalletNetwork)
  network: WalletNetwork;

  @ApiProperty({ description: 'Fiat amount', example: '50000' })
  @IsString()
  amount: string;

  @ApiProperty({ description: 'Fiat currency', example: 'NGN' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Session reference', example: 'cs-abc123' })
  @IsString()
  reference: string;
}

export class PaymentSessionQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: PaymentSessionStatus })
  @IsOptional()
  @IsEnum(PaymentSessionStatus)
  status?: PaymentSessionStatus;

  @ApiPropertyOptional({
    description: 'Filter sessions for a specific customer',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  customer_id?: string;
}
