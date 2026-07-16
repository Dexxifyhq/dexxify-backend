import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsDateString,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  InvoiceStatus,
  WalletAsset,
  WalletNetwork,
} from '../../../database/entities';

export class InvoiceLineItemDto {
  @ApiProperty({ example: 'Consulting services' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  unit_price: number;
}

export class CreateInvoiceCustomerDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({ example: '08012345678' })
  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'phone must be exactly 11 digits' })
  phone?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ type: () => CreateInvoiceCustomerDto })
  @ValidateNested()
  @Type(() => CreateInvoiceCustomerDto)
  customer: CreateInvoiceCustomerDto;

  @ApiPropertyOptional({ description: 'ISO currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currency?: string;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  line_items: InvoiceLineItemDto[];

  @ApiPropertyOptional({ description: 'Tax rate as a percentage (e.g. 7.5)', example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_rate?: number;

  @ApiPropertyOptional({ description: 'Flat discount amount', example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)', example: '2026-07-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ example: 'Thank you for your business.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: { order_ref: 'ord_123' } })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ type: [InvoiceLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  line_items?: InvoiceLineItemDto[];

  @ApiPropertyOptional({ description: 'Tax rate as a percentage', example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_rate?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ example: 'Thank you for your business.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: { order_ref: 'ord_123' } })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class InvoiceQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsUUID()
  customer_id?: string;
}

export class InvoicePaymentDto {
  @ApiProperty({ enum: WalletAsset, example: WalletAsset.USDT })
  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @ApiProperty({ enum: WalletNetwork, example: WalletNetwork.TRON })
  @IsEnum(WalletNetwork)
  network: WalletNetwork;
}
