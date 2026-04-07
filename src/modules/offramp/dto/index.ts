import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletAsset } from '../../wallets/dto';

export class CreateOfframpDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  wallet_id: string;

  @ApiProperty({ description: 'Cryptocurrency asset', enum: WalletAsset })
  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @ApiProperty({
    description: 'Cryptocurrency amount',
    example: 0.01,
    minimum: 0.00000001,
  })
  @IsNumber()
  @Min(0.00000001)
  crypto_amount: number;

  @ApiProperty({ description: 'Bank code', example: '057' })
  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @ApiProperty({ description: 'Account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @ApiProperty({ description: 'Account name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  account_name: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { source: 'mobile_app' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class GetRateDto {
  @ApiProperty({ description: 'Currency pair', example: 'USDT_NGN' })
  @IsString()
  @IsNotEmpty()
  pair: string;
}
