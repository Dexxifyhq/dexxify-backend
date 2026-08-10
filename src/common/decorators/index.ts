import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../database/entities';

type AuthenticatedUser = User & {
  mode?: 'live' | 'test';
  active_business_id?: string | null;
};

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  developer?: AuthenticatedUser;
  active_business_id?: string | null;
  apiKeyEnvironment?: 'live' | 'test';
}

// ── Auth strategy metadata keys ─────────────────────────────

/** Mark a route as public — no auth required. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Mark a route/controller as requiring cookie-based JWT auth.
 * Used for dashboard + auth routes (developer portal).
 */
export const AUTH_TYPE_KEY = 'authType';
export const CookieAuth = () => SetMetadata(AUTH_TYPE_KEY, 'cookie');

/**
 * Mark a route/controller as requiring API key auth.
 * Used for /v1/* developer API routes.
 * This is the default if no auth type is specified.
 */
export const ApiKeyAuth = () => SetMetadata(AUTH_TYPE_KEY, 'apiKey');

/**
 * Mark a route/controller as accepting EITHER API key OR cookie JWT auth.
 * ApiKeyGuard will try the Authorization header first, then fall back to
 * the access_token cookie.
 */
export const DualAuth = () => SetMetadata(AUTH_TYPE_KEY, 'dual');

// ── Param decorators ────────────────────────────────────────

/**
 * Extract the authenticated user from request.
 * Usage: @GetUser() user | @GetUser('id') userId
 */
export const GetUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user || request.developer;
    return data ? (user as Record<string, unknown> | undefined)?.[data] : user;
  },
);

/**
 * Extract the active business_id from the request.
 * Set by ApiKeyGuard from the JWT `business_id` claim or from the API key's business.
 * Returns null when no business context is active (e.g. token issued before selection).
 */
export const GetBusinessId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.active_business_id ?? null;
  },
);

/**
 * Extract the current environment mode ('live' | 'test') from the request.
 * For cookie-auth routes: reads from the JWT claim.
 * For API-key routes: reads the key's environment field.
 * Defaults to 'test' when neither is set.
 */
export const GetMode = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): 'live' | 'test' => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.developer || request.user;
    return user?.mode || request.apiKeyEnvironment || 'test';
  },
);
