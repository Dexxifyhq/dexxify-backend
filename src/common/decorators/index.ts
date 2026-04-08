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

// ── Param decorators ────────────────────────────────────────

/**
 * Extract the authenticated developer from request.
 * Works with both auth systems — both attach developer to request.
 * Usage: @GetDeveloper() developer | @GetDeveloper('id') developerId
 */
export const GetDeveloper = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // console.log('request', request);
    const developer = request.developer || request.user;
    console.log('developer', developer);
    console.log('data', data);
    return data ? developer?.[data] : developer;
  },
);
