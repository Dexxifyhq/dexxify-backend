import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

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
 * Extract the authenticated developer from request.
 * Works with both auth systems — both attach developer to request.
 * Usage: @GetDeveloper() developer | @GetDeveloper('id') developerId
 */
export const GetDeveloper = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const developer = request.developer || request.user;
    return data ? developer?.[data] : developer;
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
    const request = ctx.switchToHttp().getRequest();
    const user = request.developer || request.user;
    return user?.mode || request.apiKeyEnvironment || 'test';
  },
);
