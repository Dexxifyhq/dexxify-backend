import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawFeesDto {
  @ApiProperty({ description: 'Amount to withdraw', example: 50000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Currency', enum: ['NGN', 'USD'], example: 'NGN' })
  @IsEnum(['NGN', 'USD'])
  currency: 'NGN' | 'USD';

  @ApiProperty({
    description: 'CC recipient ID for the destination bank or wallet',
    example: 'rec_6a0ce75269321c4cb5eafe7d',
  })
  @IsString()
  @IsNotEmpty()
  recipient_id: string;

  @ApiPropertyOptional({ description: 'Narration on bank statement', example: 'Dexxify revenue' })
  @IsOptional()
  @IsString()
  narration?: string;
}
