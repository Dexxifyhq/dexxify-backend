import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RefundFeePaidBy {
  MERCHANT = 'merchant',
  CUSTOMER = 'customer',
}

export enum RefundEntityType {
  SESSION = 'session',
  INVOICE = 'invoice',
}

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class RefundDto {
  @ApiProperty({ description: 'Customer wallet address to receive the refund', example: 'TXyz1234567890abcdef' })
  @IsString()
  @IsNotEmpty()
  refundAddress: string;

  @ApiPropertyOptional({ description: 'Reason for refund', example: 'Customer requested refund' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ enum: RefundFeePaidBy, description: 'Who pays the blockchain fee. Defaults to merchant settings.' })
  @IsEnum(RefundFeePaidBy)
  @IsOptional()
  feePaidBy?: RefundFeePaidBy;
}

export class RefundQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  size?: number;

  @ApiPropertyOptional({ enum: RefundStatus })
  @IsEnum(RefundStatus)
  @IsOptional()
  status?: RefundStatus;

  @ApiPropertyOptional({ description: 'Filter by payment session reference' })
  @IsString()
  @IsOptional()
  sessionReference?: string;

  @ApiPropertyOptional({ description: 'Filter by invoice reference' })
  @IsString()
  @IsOptional()
  invoiceReference?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)', example: '2026-01-01T00:00:00Z' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)', example: '2026-12-31T23:59:59Z' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search by session or invoice reference' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class EstimateRefundQueryDto {
  @ApiProperty({ enum: RefundEntityType, description: 'Whether the reference is for a session or invoice' })
  @IsEnum(RefundEntityType)
  entity: RefundEntityType;

  @ApiPropertyOptional({ enum: RefundFeePaidBy, description: 'Who will pay the network fee' })
  @IsEnum(RefundFeePaidBy)
  @IsOptional()
  feePaidBy?: RefundFeePaidBy;
}
