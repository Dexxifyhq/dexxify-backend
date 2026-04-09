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
  // @ApiProperty({ description: 'Wallet ID', example: 'wallet_123' })
  // @IsString()
  // @IsNotEmpty()
  // wallet_id: string;

  @ApiProperty({ description: 'Wallet label', example: 'Chicken Rep Wallet' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ description: 'Bank ID', example: '033' })
  @IsString()
  @IsNotEmpty()
  bank_id: string;

  @ApiProperty({ description: 'Account number', example: '2249098732' })
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @ApiPropertyOptional({
    description: 'Enable auto settlement',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  auto_settlement?: boolean;

  @ApiProperty({ description: 'Asset ID', example: '67063f653b4a1f6c7a60ec57' })
  @IsString()
  @IsNotEmpty()
  asset_id: string;
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
  @ApiPropertyOptional({ description: 'Wallet ID' })
  @IsOptional()
  @IsString()
  wallet_id?: string;

  @ApiPropertyOptional({
    description: 'Asset ID',
    // example: '67063f653b4a1f6c7a60ec57',
  })
  @IsOptional()
  @IsString()
  asset_id?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
