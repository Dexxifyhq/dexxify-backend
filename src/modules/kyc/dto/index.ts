import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KycValidationDto {
  @ApiPropertyOptional({
    description: 'First name to match against record',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name to match against record',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded selfie image for facial match',
    example: 'data:image/jpeg;base64,...',
  })
  @IsOptional()
  @IsString()
  selfie?: string;
}

export class VerifyBvnDto {
  @ApiProperty({
    description: '11-digit Bank Verification Number',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  bvn: string;

  @ApiPropertyOptional({
    type: KycValidationDto,
    description: 'Optional fields to validate against the BVN record',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => KycValidationDto)
  validation?: KycValidationDto;
}

export class VerifyNinDto {
  @ApiProperty({
    description: '11-digit National Identification Number',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  nin: string;

  @ApiPropertyOptional({
    type: KycValidationDto,
    description: 'Optional fields to validate against the NIN record',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => KycValidationDto)
  validation?: KycValidationDto;
}

export class VerifyVninDto {
  @ApiProperty({
    description: 'Virtual NIN (16-character alphanumeric)',
    example: 'AB1234567890CDEF',
  })
  @IsString()
  @IsNotEmpty()
  vnin: string;

  @ApiPropertyOptional({
    type: KycValidationDto,
    description: 'Optional fields to validate against the vNIN record',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => KycValidationDto)
  validation?: KycValidationDto;
}

export enum RegistrationType {
  RC = 'RC',
  BN = 'BN',
  IT = 'IT',
  LP = 'LP',
  LLP = 'LLP',
}

export class VerifyCacDto {
  @ApiProperty({ description: 'CAC Registration Number', example: 'RC123456' })
  @IsString()
  @IsNotEmpty()
  rc_number: string;

  @ApiProperty({
    description: 'Type of business registration',
    enum: RegistrationType,
    example: RegistrationType.RC,
  })
  @IsEnum(RegistrationType)
  registration_type: RegistrationType;

  @ApiPropertyOptional({
    description: 'Registered business name for additional matching',
    example: 'Acme Corp Ltd',
  })
  @IsOptional()
  @IsString()
  registration_name?: string;
}
