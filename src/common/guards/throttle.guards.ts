import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { Request } from 'express';

interface ThrottledRequest extends Request {
  user?: { id?: string };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as ThrottledRequest;
    // Priority: user ID > IP address > forwarded IP > unknown
    const tracker =
      request.user?.id?.toString() || this.getIpAddress(request) || 'unknown';

    return Promise.resolve(tracker);
  }

  private getIpAddress(req: ThrottledRequest): string | undefined {
    // Handle various proxy headers
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwarded = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    return (
      (Array.isArray(realIp) ? realIp[0] : realIp) ||
      req.socket?.remoteAddress ||
      req.ip
    );
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();

    this.logger.warn(
      `Rate limit exceeded for tracker: ${throttlerLimitDetail.tracker} on ${request.method} ${request.path}`,
    );

    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
