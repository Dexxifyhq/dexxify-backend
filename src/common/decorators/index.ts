import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

/**
 * Extract the authenticated developer from request.
 * Usage: @GetDeveloper() developer: Developer
 */
export const GetDeveloper = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const developer = request.developer;
    console.log('developer', developer);
    console.log('data', data);
    return data ? developer?.[data] : developer;
  },
);

/**
 * Mark a route as public (no auth required).
 * Usage: @Public()
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Mark a route as requiring API key auth (not JWT).
 * Usage: @ApiKeyAuth()
 */
export const API_KEY_AUTH = 'apiKeyAuth';
export const ApiKeyAuth = () => SetMetadata(API_KEY_AUTH, true);
