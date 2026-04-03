import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';

export enum WalletAsset {
  BTC = 'BTC',
  USDT = 'USDT',
  ETH = 'ETH',
  USDC = 'USDC',
}

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @IsEnum(WalletAsset)
  asset: WalletAsset;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class TransferDto {
  @IsUUID()
  from_wallet_id: string;

  @IsUUID()
  to_wallet_id: string;

  @IsNumber()
  @Min(0.00000001)
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class WalletQueryDto {
  @IsOptional()
  @IsString()
  external_user_id?: string;

  @IsOptional()
  @IsEnum(WalletAsset)
  asset?: WalletAsset;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
