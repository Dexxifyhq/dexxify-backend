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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayoutDto {
  @ApiProperty({
    description: 'Payout amount in NGN',
    example: 5000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ description: 'Bank code', example: '057' })
  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @ApiProperty({ description: 'Account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @ApiPropertyOptional({ description: 'Account name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  account_name?: string;

  @ApiPropertyOptional({
    description: 'Payment narration',
    example: 'Salary payment',
  })
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { source: 'payroll' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class BatchPayoutDto {
  @ApiProperty({
    description: 'Array of payout requests',
    type: [CreatePayoutDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePayoutDto)
  payouts: CreatePayoutDto[];
}

export class ResolveAccountDto {
  @ApiProperty({ description: 'Bank code', example: '057' })
  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @ApiProperty({ description: 'Account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  account_number: string;
}
