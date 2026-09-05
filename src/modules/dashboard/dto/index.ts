import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiPropertyOptional({
    description: 'API key label',
    example: 'Mobile App Key',
  })
  @IsString()
  @IsOptional()
  label?: string;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional({
    description: 'API key label',
    example: 'Updated Mobile App Key',
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    description: 'IP whitelist',
    example: ['192.168.1.1', '10.0.0.1'],
    isArray: true,
  })
  @IsOptional()
  ip_whitelist?: string[];
}
