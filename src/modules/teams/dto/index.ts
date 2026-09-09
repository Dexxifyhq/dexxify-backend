import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: BusinessRole, example: BusinessRole.ADMIN })
  @IsEnum(BusinessRole)
  @IsOptional()
  role?: BusinessRole;

  @ApiPropertyOptional({
    enum: BusinessUserStatus,
    example: BusinessUserStatus.SUSPENDED,
  })
  @IsEnum(BusinessUserStatus)
  @IsOptional()
  status?: BusinessUserStatus;
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

  @ApiProperty({
    description:
      'User password — min 8 characters, must include at least one uppercase letter, one number, and one special character',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message:
      'Password must contain at least one uppercase letter, one number, and one special character.',
  })
  password: string;
}
