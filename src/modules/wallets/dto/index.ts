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

export enum WithdrawalNetwork {
  ERC20 = 'ERC20',
  TRC20 = 'TRC20',
  SOL = 'SOL',
  BSC = 'BSC',
  TON = 'TON',
}

export enum WithdrawalToken {
  USDT = 'USDT',
  USDC = 'USDC',
}

export class CreateWalletDto {
  // @ApiProperty({ description: 'Wallet ID', example: 'wallet_123' })
  // @IsString()
  // @IsNotEmpty()
  // wallet_id: string;

  @ApiProperty({ description: 'Wallet label', example: 'Wallet' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ description: 'Bank ID', example: '39' })
  @IsString()
  @IsOptional()
  // @IsNotEmpty()
  bank_id: string;

  @ApiPropertyOptional({ description: 'Account number', example: '2249098732' })
  @IsString()
  @IsOptional()
  // @IsNotEmpty()
  account_number: string;

  @ApiPropertyOptional({
    description: 'Enable auto settlement',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  auto_settlement: boolean;

  @ApiProperty({ description: 'Asset ID', example: '6930298330b92dbdfc0267a4' })
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
    // example: '6930298330b92dbdfc0267a4',
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

export class MockTradeDto {
  @ApiProperty({
    description: 'Wallet deposit address to credit (Must match the asset)',
    example: '5WEWHj6U44LVifRSVuGY4YPGfL4hPjKL4nmEQpzrJPK1',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({
    description: 'Asset',
    example: 'SOL_TEST',
  })
  @IsString()
  @IsNotEmpty()
  asset: string;

  @ApiProperty({ description: 'Amount in USD', example: 5, minimum: 1 })
  @IsNumber()
  @Min(1)
  amountInUSD: number;

  @ApiProperty({
    description: 'Crypto amount received',
    example: 10,
    minimum: 0.00000001,
  })
  @IsNumber()
  @Min(0.00000001)
  cryptoReceived: number;

  @ApiPropertyOptional({
    description: 'Unique reference for the mock transaction',
    example: '',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Mock transaction hash', example: '' })
  @IsOptional()
  @IsString()
  txHash?: string;

  @ApiPropertyOptional({
    description: 'Source wallet address',
    example: 'TSource1234567890AbCdEfGhIjKlMnOpQr',
  })
  @IsOptional()
  @IsString()
  sourceAddress?: string;

  @ApiPropertyOptional({
    description: 'Number of confirmations',
    example: 2,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  confirmations?: number;
}

export class AddWithdrawalAddressDto {
  @ApiProperty({
    description: 'Withdrawal wallet address',
    example: 'UQCvj9LMypzHShhTvO1qSLE0XiWxopEMweLh8MFnY3mxzLvi',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: WithdrawalNetwork.TON,
  })
  @IsEnum(WithdrawalNetwork)
  @IsNotEmpty()
  network: WithdrawalNetwork;

  @ApiProperty({
    description: 'Token symbol',
    example: WithdrawalToken.USDT,
  })
  @IsEnum(WithdrawalToken)
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Label for the address',
    example: 'My USDT Wallet',
  })
  @IsString()
  @IsNotEmpty()
  label: string;
}

// Note for withdrawals, USDC is not supported on TON
export class InitiateStableCoinWithdrawalDto {
  @ApiProperty({
    description: 'Withdrawal wallet address',
    example: 'UQCvj9LMypzHShhTvO1qSLE0XiWxopEMweLh8MFnY3mxzLvi',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Amount to withdraw', example: 5, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Pin on the dashboard',
    example: '3847',
  })
  @IsString()
  @IsOptional()
  pin?: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: WithdrawalNetwork.TON,
  })
  @IsEnum(WithdrawalNetwork)
  @IsNotEmpty()
  network: WithdrawalNetwork;

  @ApiProperty({
    description: 'Token symbol',
    example: WithdrawalToken.USDT,
  })
  @IsEnum(WithdrawalToken)
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Unique Reference for later withdrawals',
    example: '53439454689865453',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;
}

export class InitiateFiatWithdrawalDto {
  @ApiProperty({ description: 'Bank ID', example: '6a0ce75269321c4cb5eafe7d' })
  @IsString()
  @IsNotEmpty()
  bank_id: string;

  @ApiProperty({
    description: 'Amount to withdraw in NGN/GHS',
    example: 2000,
    minimum: 2000,
  })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Optional note that appears on bank statement',
    example: 'Dexxify Payout',
  })
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({
    description: 'Pin on the dashboard',
    example: '3847',
  })
  @IsString()
  @IsOptional()
  pin?: string;
}
