import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsEnum(['sandbox', 'live'])
  environment: 'sandbox' | 'live';
}

export class UpdateApiKeyDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsOptional()
  ip_whitelist?: string[];
}
