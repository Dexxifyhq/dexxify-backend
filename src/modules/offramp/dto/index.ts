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

export class CreateOfframpDto {
  @IsUUID()
  wallet_id: string;

  @IsEnum(WalletAsset)
  crypto_asset: WalletAsset;

  @IsNumber()
  @Min(0.00000001)
  crypto_amount: number;

  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsNotEmpty()
  account_name: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class GetRateDto {
  @IsString()
  @IsNotEmpty()
  pair: string; // e.g. "USDT_NGN"
}
