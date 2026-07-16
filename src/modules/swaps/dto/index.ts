import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SwapCurrency {
  NGN = 'NGN',
  USDT = 'USDT',
  USDC = 'USDC',
}

export enum SwapFromCurrency {
  NGN = 'NGN',
  USDT = 'USDT',
  USDC = 'USDC',
  ETH = 'ETH',
  BNB = 'BNB',
  SOL = 'SOL',
  TRX = 'TRX',
}

export class EstimateSwapDto {
  @ApiProperty({ enum: SwapFromCurrency, description: 'Currency to swap from' })
  @IsEnum(SwapFromCurrency)
  fromCurrency: SwapFromCurrency;

  @ApiProperty({ enum: SwapCurrency, description: 'Currency to swap to' })
  @IsEnum(SwapCurrency)
  toCurrency: SwapCurrency;

  @ApiProperty({ description: 'Amount to swap', example: '100.00' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class CreateSwapQuotationDto {
  @ApiProperty({ enum: SwapCurrency, description: 'Currency to swap from' })
  @IsEnum(SwapCurrency)
  fromCurrency: SwapCurrency;

  @ApiProperty({ enum: SwapCurrency, description: 'Currency to swap to' })
  @IsEnum(SwapCurrency)
  toCurrency: SwapCurrency;

  @ApiProperty({ description: 'Amount to swap', example: '100.00' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class SwapQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  size?: number;

  @ApiPropertyOptional({ enum: SwapCurrency })
  @IsOptional()
  @IsEnum(SwapCurrency)
  fromCurrency?: SwapCurrency;

  @ApiPropertyOptional({ enum: SwapCurrency })
  @IsOptional()
  @IsEnum(SwapCurrency)
  toCurrency?: SwapCurrency;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
