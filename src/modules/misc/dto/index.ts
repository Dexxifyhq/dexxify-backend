import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum RateTo {
  NGN = 'NGN',
  USD = 'USD',
}

export enum RateFrom {
  BTC = 'BTC',
  BNB = 'BNB',
  ETH = 'ETH',
  USDT = 'USDT',
  USDC = 'USDC',
  SOL = 'SOL',
  TRX = 'TRX',
}

export class GetRateQueryDto {
  @ApiProperty({ description: 'Source asset', example: RateFrom.USDT })
  @IsEnum(RateFrom)
  @IsNotEmpty()
  from: RateFrom;

  @ApiProperty({ description: 'Fiat currency', example: RateTo.NGN })
  @IsEnum(RateTo)
  @IsNotEmpty()
  to: RateTo;
}

export class AddBankDto {
  @ApiProperty({ description: 'Bank account number', example: '8065924354' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'Bank code (e.g. 305 for OPay)',
    example: '305',
  })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiPropertyOptional({
    description: 'Friendly label',
    example: 'My OpayBank',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'Default account recipient',
    example: false,
  })
  @IsBoolean()
  isDefault: boolean;
}

export class VerifyBankAccountDto {
  @ApiProperty({ description: 'Bank account number', example: '2249098732' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'Bank code (e.g. 033 for UBABank)',
    example: '033',
  })
  @IsString()
  @IsNotEmpty()
  bankCode: string;
}
