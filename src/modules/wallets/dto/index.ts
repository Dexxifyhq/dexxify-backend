import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WalletAsset {
  BTC = 'BTC',
  USDT = 'USDT',
  ETH = 'ETH',
  USDC = 'USDC',
}

export class CreateWalletDto {
  @ApiProperty({ description: 'Wallet ID', example: 'wallet_123' })
  @IsString()
  @IsNotEmpty()
  wallet_id: string;

  @ApiProperty({ description: 'Bank ID', example: 'bank_456' })
  @IsString()
  @IsNotEmpty()
  bank_id: string;

  @ApiProperty({ description: 'Account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @ApiPropertyOptional({
    description: 'Enable auto settlement',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  auto_settlement?: boolean;

  @ApiProperty({ description: 'Asset type', enum: WalletAsset })
  @IsEnum(WalletAsset)
  asset: WalletAsset;
}

export class TransferDto {
  @ApiProperty({
    description: 'Source wallet ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  from_wallet_id: string;

  @ApiProperty({
    description: 'Destination wallet ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  to_wallet_id: string;

  @ApiProperty({
    description: 'Transfer amount',
    example: 0.01,
    minimum: 0.00000001,
  })
  @IsNumber()
  @Min(0.00000001)
  amount: number;

  @ApiPropertyOptional({
    description: 'Transfer narration',
    example: 'Payment for services',
  })
  @IsOptional()
  @IsString()
  narration?: string;
}

export class WalletQueryDto {
  @ApiPropertyOptional({ description: 'Wallet ID', example: 'wallet_123' })
  @IsOptional()
  @IsString()
  wallet_id?: string;

  @ApiPropertyOptional({ description: 'Asset type', enum: WalletAsset })
  @IsOptional()
  @IsEnum(WalletAsset)
  asset?: WalletAsset;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
