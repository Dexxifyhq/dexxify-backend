import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed or the request body/params were malformed.',
  401: 'Missing, invalid, or expired authentication.',
  403: 'Authenticated, but not permitted to perform this action.',
  404: 'The requested resource could not be found.',
  409: 'The resource already exists or is in a conflicting state.',
};

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Validation failed.',
  401: 'Invalid or inactive API key.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource could not be found.',
  409: 'The resource already exists.',
};

const EXAMPLE_TIMESTAMP = '2026-09-17T12:00:00.000Z';

export interface ErrorResponseSpec {
  status: number;
  message: string;
  /** Populate only for 400s that come from class-validator field errors. */
  errors?: string[];
}

type ErrorResponseInput = number | ErrorResponseSpec;

export const ApiErrorResponses = (...specs: ErrorResponseInput[]) =>
  applyDecorators(
    ...specs.map((spec) => {
      const status = typeof spec === 'number' ? spec : spec.status;
      const message =
        typeof spec === 'number'
          ? (FALLBACK_MESSAGES[status] ?? 'Request failed.')
          : spec.message;
      const errors = typeof spec === 'number' ? undefined : spec.errors;

      return ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Request failed.',
        type: ErrorResponseDto,
        example: {
          success: false,
          status,
          message,
          timestamp: EXAMPLE_TIMESTAMP,
          ...(errors ? { errors } : {}),
        },
      });
    }),
  );
