import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
  Min,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  PaymentPageStatus,
  WalletAsset,
  WalletNetwork,
} from '../../../database/entities';

export class CreatePaymentPageDto {
  @ApiProperty({ example: 'Summer Sale Checkout' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Pay for your order securely.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PaymentPageStatus })
  @IsEnum(PaymentPageStatus)
  status: PaymentPageStatus;

  @ApiPropertyOptional({
    description: 'Custom slug. Auto-generated from title if omitted.',
    example: 'summer-sale-x9k2',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

  @ApiPropertyOptional({ description: 'ISO currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Amount',
    example: 50,
  })
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  auto_settlement?: boolean;
}

export class UpdatePaymentPageDto {
  @ApiPropertyOptional({ example: 'Updated Sale Checkout' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'New description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ enum: PaymentPageStatus })
  @IsOptional()
  @IsEnum(PaymentPageStatus)
  status?: PaymentPageStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  auto_settlement?: boolean;
}

export class PaymentPageQueryDto {
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

  @ApiPropertyOptional({ enum: PaymentPageStatus })
  @IsOptional()
  @IsEnum(PaymentPageStatus)
  status?: PaymentPageStatus;
}

export class PublicPayDto {
  @ApiProperty({
    type: 'string',
    enum: WalletAsset,
    enumName: 'WalletAsset',
    description: 'Cryptocurrency asset to pay with',
    example: WalletAsset.USDT,
  })
  @IsEnum(WalletAsset)
  asset: WalletAsset;

  @ApiProperty({
    type: 'string',
    enum: WalletNetwork,
    enumName: 'WalletNetwork',
    description: 'Blockchain network for the payment',
    example: WalletNetwork.TRON,
  })
  @IsEnum(WalletNetwork)
  network: WalletNetwork;

  @ApiPropertyOptional({
    description: 'Amount',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiProperty({
    description: 'Customer first name',
    example: 'Billy',
  })
  @IsString()
  first_name: string;

  @ApiProperty({
    description: 'Customer last name',
    example: 'James',
  })
  @IsString()
  last_name: string;

  @ApiProperty({
    description: 'Customer email',
    example: 'james@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}
