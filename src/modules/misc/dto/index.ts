import { IsOptional, IsString } from 'class-validator';

export class GetRateQueryDto {
  @IsString()
  @IsOptional()
  source?: string; // e.g. 'USDT'

  @IsString()
  @IsOptional()
  target?: string; // e.g. 'NGN'
}
