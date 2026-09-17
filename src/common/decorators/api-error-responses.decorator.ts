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

/**
 * Documents one or more standard error responses (matching the shape
 * produced by GlobalExceptionFilter) on an endpoint. Pass the HTTP status
 * codes the underlying service can actually throw, e.g.
 * `@ApiErrorResponses(400, 401, 404)`.
 */
export const ApiErrorResponses = (...statuses: number[]) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Request failed.',
        type: ErrorResponseDto,
      }),
    ),
  );
