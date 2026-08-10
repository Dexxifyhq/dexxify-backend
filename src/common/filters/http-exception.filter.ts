import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as { message?: string; errors?: unknown };
        message = body.message || message;
        errors = body.errors;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = 'Something went wrong';
    }

    response.status(status).json({
      success: false,
      status,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
