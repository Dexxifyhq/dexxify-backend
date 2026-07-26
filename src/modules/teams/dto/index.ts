import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessRole, BusinessUserStatus } from '../../../database/entities';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address to invite',
    example: 'colleague@company.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: [BusinessRole.ADMIN, BusinessRole.STAFF],
    example: BusinessRole.STAFF,
    description: 'Role to assign',
  })
  @IsEnum(BusinessRole)
  role: BusinessRole;

  @ApiPropertyOptional({
    description: 'Granular permission keys to grant',
    example: ['withdraw_bank', 'manage_payment_pages'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: BusinessRole, example: BusinessRole.ADMIN })
  @IsEnum(BusinessRole)
  @IsOptional()
  role?: BusinessRole;

  @ApiPropertyOptional({ enum: BusinessUserStatus, example: BusinessUserStatus.SUSPENDED })
  @IsEnum(BusinessUserStatus)
  @IsOptional()
  status?: BusinessUserStatus;

  @ApiPropertyOptional({
    description: 'Updated permission keys',
    example: ['manage_payment_pages'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Invitation token from the email link',
    example: 'abc123def456...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'First name', example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ description: 'Password (min 8 chars)', example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
