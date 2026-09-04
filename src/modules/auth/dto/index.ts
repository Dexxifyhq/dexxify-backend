import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'mikasa@life.com',
  })
  @IsEmail()
  email: string;

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

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format, e.g. +2348065924354',
    example: '+2348065924354',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone number must be in E.164 format, e.g. +2348065924354.',
  })
  phone?: string;

  // Honeypot — deliberately undocumented (no @ApiProperty), so it doesn't
  // appear in the public Swagger spec
  @IsOptional()
  @IsString()
  website?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'dexxifyhq@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User password', example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User email address',
    example: 'polly@life.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  code: string;
}

export class ResendOtpDto {
  @ApiProperty({
    description: 'User email address',
    example: 'jones@life.com',
  })
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'jones@life.com',
  })
  @IsEmail()
  email: string;
}

export class SwitchModeDto {
  @ApiProperty({
    description: 'Target environment mode',
    enum: ['live', 'test'],
    example: 'live',
  })
  @IsString()
  @IsNotEmpty()
  mode: 'live' | 'test';
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'jones@life.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  code: string;

  @ApiProperty({
    description:
      'New password — min 8 characters, must include at least one uppercase letter, one number, and one special character',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message:
      'Password must contain at least one uppercase letter, one number, and one special character.',
  })
  new_password: string;
}

export class SelectBusinessDto {
  @ApiProperty({
    description: 'ID of the business workspace to activate',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  business_id: string;
}
