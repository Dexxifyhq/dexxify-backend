import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LedgerQueryDto {
  @ApiPropertyOptional({ description: 'Transaction type filter', example: 'deposit' })
  @IsOptional()
  @IsString()
  tx_type?: string;

  @ApiPropertyOptional({ description: 'Reference type filter', example: 'payment_session' })
  @IsOptional()
  @IsString()
  reference_type?: string;

  @ApiPropertyOptional({
    description: 'From date (ISO format)',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'To date (ISO format)',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsString()
  to_date?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 10 })
  @IsOptional()
  limit?: number;
}
