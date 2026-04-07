import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyBvnDto {
  @ApiProperty({ description: 'External user ID', example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @ApiProperty({
    description: 'Bank Verification Number',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  bvn: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({ description: 'Date of birth', example: '1990-01-01' })
  @IsOptional()
  @IsString()
  date_of_birth?: string;
}

export class VerifyNinDto {
  @ApiProperty({ description: 'External user ID', example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @ApiProperty({
    description: 'National Identification Number',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  nin: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;
}

export class VerifyDocumentDto {
  @ApiProperty({ description: 'External user ID', example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @ApiProperty({
    description: 'Document type',
    enum: ['national_id', 'passport', 'drivers_licence'],
  })
  @IsEnum(['national_id', 'passport', 'drivers_licence'])
  document_type: string;

  @ApiProperty({
    description: 'Document URL',
    example: 'https://example.com/document.jpg',
  })
  @IsUrl()
  document_url: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;
}

export class LivenessCheckDto {
  @ApiProperty({ description: 'External user ID', example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @ApiProperty({
    description: 'Selfie URL',
    example: 'https://example.com/selfie.jpg',
  })
  @IsUrl()
  selfie_url: string;

  @ApiPropertyOptional({
    description: 'Document URL for selfie-to-ID match',
    example: 'https://example.com/document.jpg',
  })
  @IsOptional()
  @IsUrl()
  document_url?: string;
}
