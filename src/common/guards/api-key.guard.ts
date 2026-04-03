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
import { IS_PUBLIC_KEY } from '../decorators';
import { hashApiKey } from '../utils';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException(
        'Missing API key. Include x-api-key header.',
      );
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

    request.developer = keyRecord.developer;
    request.apiKeyEnvironment = keyRecord.environment;

    return true;
  }
}
