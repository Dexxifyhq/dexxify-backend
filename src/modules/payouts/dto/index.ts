import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePayoutDto {
  @IsNumber()
  @Min(100)
  amount: number;

  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsOptional()
  account_name?: string;

  @IsString()
  @IsOptional()
  narration?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class BatchPayoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePayoutDto)
  payouts: CreatePayoutDto[];
}

export class ResolveAccountDto {
  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;
}
