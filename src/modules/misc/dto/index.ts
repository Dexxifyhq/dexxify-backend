import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum RateTo {
  NGN = 'ngn',
  GHS = 'ghs',
  USD = 'usd',
  CAD = 'cad',
  AUD = 'aud',
  GBP = 'gbp',
  EUR = 'eur',
}

// Commented out assets possess isAccountBased: false, on Breet
export enum RateFrom {
  // BCH = 'BCH',
  // DOGE = 'DOGE',
  // LTC = 'LTC',
  // BTC = 'BTC',
  BNB = 'BNB',
  ETH = 'ETH',
  USDT = 'USDT',
  USDC = 'USDC',
  SOL = 'SOL',
  TRX = 'TRX',
  XRP = 'XRP',
  AVAX = 'AVAX',
  TON = 'TON',
}

export class GetRateQueryDto {
  @ApiProperty({
    description: 'Source Asset',
    example: RateFrom.USDT,
  })
  @IsEnum(RateFrom)
  @IsNotEmpty()
  from: RateFrom; // e.g. 'USDT'

  @ApiProperty({
    description: 'Fiat currency',
    example: RateTo.NGN,
  })
  @IsEnum(RateTo)
  @IsNotEmpty()
  to: RateTo; // e.g. 'NGN'
}

export enum BankCurrency {
  NGN = 'NGN',
  GHS = 'GHS',
}

export class AddBankDto {
  @ApiProperty({
    description: 'Bank account number',
    example: '3154021148',
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'Breet Bank ID',
    example: '39',
  })
  @IsString()
  @IsNotEmpty()
  bankId: string;

  // @ApiProperty({
  //   description: 'Currency',
  //   enum: BankCurrency,
  //   example: BankCurrency.NGN,
  // })
  // @IsEnum(BankCurrency)
  // @IsNotEmpty()
  // currency: BankCurrency;

  @ApiPropertyOptional({
    description: 'Narration for the bank account',
    example: 'My Zenith Account',
  })
  @IsOptional()
  @IsString()
  narration?: string;
}

export class VerifyBankAccountDto {
  @ApiProperty({
    description: 'Bank account number',
    example: '1234567890',
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'Breet Bank ID',
    example: '057',
  })
  @IsString()
  @IsNotEmpty()
  bankId: string;
}
