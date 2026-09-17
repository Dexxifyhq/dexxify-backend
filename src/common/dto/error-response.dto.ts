import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape produced by GlobalExceptionFilter for every thrown HttpException.
 * Used as the `type` for Swagger error @ApiResponse entries so the
 * reference docs match what callers actually receive.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  status: number;

  @ApiProperty({ example: 'Validation failed.' })
  message: string;

  @ApiProperty({
    required: false,
    example: ['amount must not be less than 0'],
  })
  errors?: unknown;

  @ApiProperty({ example: '2026-09-17T12:00:00.000Z' })
  timestamp: string;
}
