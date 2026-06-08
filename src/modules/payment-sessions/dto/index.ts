import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentSessionStatus, WalletAsset } from '../../../database/entities';

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
    description: 'Crypto asset (required for onramp/offramp)',
    enum: WalletAsset,
  })
  @IsOptional()
  @IsEnum(WalletAsset)
  crypto_asset?: WalletAsset;

  @ApiPropertyOptional({
    description: 'Customer ID to link this session to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({
    description: 'Minutes until this session expires (default: 30)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expires_in_minutes?: number;

  @ApiPropertyOptional({
    description: 'Arbitrary key-value data',
    example: { order_id: 'ord_xyz' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
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
