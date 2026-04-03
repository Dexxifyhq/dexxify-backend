import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class VerifyBvnDto {
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @IsString()
  @IsNotEmpty()
  bvn: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsOptional()
  @IsString()
  date_of_birth?: string; // YYYY-MM-DD
}

export class VerifyNinDto {
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @IsString()
  @IsNotEmpty()
  nin: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;
}

export class VerifyDocumentDto {
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @IsEnum(['national_id', 'passport', 'drivers_licence'])
  document_type: string;

  @IsUrl()
  document_url: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;
}

export class LivenessCheckDto {
  @IsString()
  @IsNotEmpty()
  external_user_id: string;

  @IsUrl()
  selfie_url: string;

  @IsOptional()
  @IsUrl()
  document_url?: string; // for selfie-to-ID match
}
