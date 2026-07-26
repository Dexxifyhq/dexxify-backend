import {
  IsOptional,
  IsString,
  MinLength,
  IsNotEmpty,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Samuel' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Uzor' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348110015132',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'UI theme preference',
    enum: ['system', 'dark', 'light'],
    example: 'system',
  })
  @IsString()
  @IsOptional()
  theme_preference?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'OldPass123!' })
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @ApiProperty({ description: 'New password (min 8 chars)', example: 'NewPass123!' })
  @IsString()
  @MinLength(8)
  new_password: string;
}
