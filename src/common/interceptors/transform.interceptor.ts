import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload: unknown): ApiResponse<T> => {
        const envelope = isRecord(payload) ? payload : undefined;

        // If the handler already returned a shaped response, pass through
        if (envelope && envelope.success !== undefined) {
          return payload as ApiResponse<T>;
        }

        const meta = isRecord(envelope?.meta) ? envelope.meta : undefined;

        return {
          success: true,
          data: (envelope && 'data' in envelope ? envelope.data : payload) as T,
          ...(meta && { meta }),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
