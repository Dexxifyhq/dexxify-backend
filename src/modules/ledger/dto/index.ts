import { IsEnum, IsOptional, IsString } from 'class-validator';

export class LedgerQueryDto {
  @IsOptional()
  @IsString()
  tx_type?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reference_type?: string;

  @IsOptional()
  @IsString()
  from_date?: string; // ISO date

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
