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
import { WalletAsset } from '../../../database/entities';

export class CreateOfframpDto {
  @ApiProperty({
    description: 'Wallet ID (source of crypto)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  wallet_id: string;

  @ApiProperty({ description: 'Cryptocurrency asset to sell', enum: WalletAsset })
  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @ApiProperty({
    description: 'Cryptocurrency amount to sell',
    example: 10,
    minimum: 0.00000001,
  })
  @IsNumber()
  @Min(0.00000001)
  crypto_amount: number;

  @ApiProperty({
    description:
      'CC recipient ID for the bank account to receive NGN payout. Register via POST /wallets/withdrawal-addresses.',
    example: 'rec_6a0ce75269321c4cb5eafe7d',
  })
  @IsString()
  @IsNotEmpty()
  recipient_id: string;

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
