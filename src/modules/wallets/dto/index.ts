import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsNumberString,
  Length,
  Min,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WithdrawalNetwork {
  BSC = 'bsc',
  TRC20 = 'tron',
  SOL = 'solana',
  BASE = 'base',
  ERC20 = 'ethereum',
}

export enum WithdrawalToken {
  USDT = 'USDT',
  USDC = 'USDC',
}

export enum DepositIdentityType {
  STATIC_DEPOSIT_ADDRESS = 'static_deposit_address',
  NGN_VIRTUAL_ACCOUNT = 'ngn_virtual_account',
}

// Chains supported by the CC deposit identity API (subset of WalletNetwork)
export enum DepositIdentityChain {
  BITCOIN = 'bitcoin',
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  BSC = 'bsc',
  TRON = 'tron',
  BASE = 'base',
  ARBITRUM = 'arbitrum',
}

export class IssueDepositIdentityDto {
  @ApiProperty({
    enum: DepositIdentityType,
    example: DepositIdentityType.STATIC_DEPOSIT_ADDRESS,
    description:
      'static_deposit_address issues a crypto address; ngn_virtual_account issues an NGN bank account',
  })
  @IsEnum(DepositIdentityType)
  type: DepositIdentityType;

  @ApiPropertyOptional({
    enum: DepositIdentityChain,
    example: DepositIdentityChain.TRON,
    description: 'Required when type is static_deposit_address',
  })
  @ValidateIf((o) => o.type === DepositIdentityType.STATIC_DEPOSIT_ADDRESS)
  @IsEnum(DepositIdentityChain)
  chain?: DepositIdentityChain;

  @ApiPropertyOptional({
    example: '12345678901',
    description:
      'BVN of the account holder (11 digits). Required when type is ngn_virtual_account',
  })
  @ValidateIf((o) => o.type === DepositIdentityType.NGN_VIRTUAL_ACCOUNT)
  @IsNumberString()
  @Length(11, 11, { message: 'bvn must be exactly 11 digits' })
  bvn?: string;
}

export class CreateWalletDto {
  @ApiPropertyOptional({
    description: 'CC Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  customer_id?: string;
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
    example: WithdrawalNetwork.BSC,
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

  @ApiProperty({
    description: 'Default wallet account',
    example: true,
  })
  @IsBoolean()
  isDefault: boolean;
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

  // @ApiPropertyOptional({
  //   description: 'Pin on the dashboard',
  //   example: '3847',
  // })
  // @IsString()
  // @IsOptional()
  // pin?: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: WithdrawalNetwork.BSC,
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
