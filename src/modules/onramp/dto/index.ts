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

export class CreateOnrampDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  wallet_id: string;

  @ApiProperty({ description: 'Cryptocurrency asset', enum: WalletAsset })
  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @ApiProperty({ description: 'Amount in NGN', example: 50000, minimum: 100 })
  @IsNumber()
  @Min(100)
  ngn_amount: number;

  @ApiPropertyOptional({
    description: 'Payment reference from Paystack charge/VA funding',
    example: 'paystack_ref_123',
  })
  @IsOptional()
  @IsString()
  payment_reference?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { source: 'mobile_app' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
