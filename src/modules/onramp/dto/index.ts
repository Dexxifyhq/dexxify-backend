import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { WalletAsset } from '../../wallets/dto';

export class CreateOnrampDto {
  @IsUUID()
  wallet_id: string;

  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @IsNumber()
  @Min(100)
  ngn_amount: number;

  @IsOptional()
  @IsString()
  payment_reference?: string; // reference from Paystack charge / VA funding

  @IsOptional()
  metadata?: Record<string, any>;
}
