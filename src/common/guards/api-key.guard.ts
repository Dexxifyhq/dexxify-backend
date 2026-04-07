import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../../database/entities';
import { IS_PUBLIC_KEY, AUTH_TYPE_KEY } from '../decorators';
import { hashApiKey } from '../utils';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip if route explicitly uses cookie auth (dashboard/auth routes)
    const authType = this.reflector.getAllAndOverride<string>(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authType === 'cookie') return true;

    // This is an API key route — extract from Authorization header
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException(
        'Missing authorization. Include Authorization: Bearer <api_key> header.',
      );
    }

    // Support "Bearer dex_live_..." format
    const apiKey = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!apiKey) {
      throw new UnauthorizedException('Invalid authorization header format.');
    }

    const keyHash = hashApiKey(apiKey);

    const keyRecord = await this.apiKeyRepo.findOne({
      where: { key_hash: keyHash, is_active: true },
      relations: ['developer'],
    });

    if (!keyRecord) {
      throw new UnauthorizedException('Invalid or inactive API key.');
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      throw new UnauthorizedException('API key has expired.');
    }

    if (keyRecord.ip_whitelist?.length > 0) {
      const clientIp = request.ip || request.connection?.remoteAddress;
      if (!keyRecord.ip_whitelist.includes(clientIp)) {
        throw new UnauthorizedException(
          'IP address not whitelisted for this API key.',
        );
      }
    }

    if (keyRecord.developer?.status !== 'active') {
      throw new UnauthorizedException('Developer account is not active.');
    }

    // Fire and forget — update last used
    this.apiKeyRepo.update(keyRecord.id, { last_used_at: new Date() });

    // Attach to request (same property name so @GetDeveloper works for both)
    request.developer = keyRecord.developer;
    request.apiKeyEnvironment = keyRecord.environment;

    return true;
  }
}
