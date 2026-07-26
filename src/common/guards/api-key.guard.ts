import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiKey,
  User,
  UserStatus,
} from '../../database/entities';
import { IS_PUBLIC_KEY, AUTH_TYPE_KEY } from '../decorators';
import { hashApiKey } from '../utils';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const authType = this.reflector.getAllAndOverride<string>(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Cookie-only routes — Passport JWT guard handles them
    if (authType === 'cookie') return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // ── Dual auth: API key OR cookie JWT ────────────────
    if (authType === 'dual') {
      if (authHeader) {
        return this.validateApiKey(request, authHeader);
      }
      return this.validateCookieJwt(request);
    }

    // ── Default: API key only ────────────────────────────
    if (!authHeader) {
      throw new UnauthorizedException(
        'Missing authorization. Include Authorization: Bearer <api_key> header.',
      );
    }
    return this.validateApiKey(request, authHeader);
  }

  private async validateApiKey(
    request: any,
    authHeader: string,
  ): Promise<boolean> {
    const apiKey = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!apiKey) {
      throw new UnauthorizedException('Invalid authorization header format.');
    }

    const keyHash = hashApiKey(apiKey);
    const keyRecord = await this.apiKeyRepo.findOne({
      where: { key_hash: keyHash, is_active: true },
      relations: ['user'],
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

    if (keyRecord.user?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active.');
    }

    this.apiKeyRepo.update(keyRecord.id, { last_used_at: new Date() });

    request.user = keyRecord.user;
    request.developer = keyRecord.user; // backward compat
    request.apiKeyEnvironment = keyRecord.mode;
    request.active_business_id = keyRecord.business_id ?? null;

    return true;
  }

  private async validateCookieJwt(request: any): Promise<boolean> {
    const token = request?.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException(
        'Missing authorization. Provide an API key or a valid session cookie.',
      );
    }

    try {
      const secret =
        this.configService.get<string>('jwt.secret') || 'fallback-secret';

      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        type: string;
        mode?: 'live' | 'test';
        business_id?: string | null;
      }>(token, { secret });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type.');
      }

      const user = await this.userRepo.findOne({
        where: { id: payload.sub, status: UserStatus.ACTIVE },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or inactive account.');
      }

      const enrichedUser = Object.assign(user, {
        mode: payload.mode ?? 'test',
        active_business_id: payload.business_id ?? null,
      });

      request.user = enrichedUser;
      request.developer = enrichedUser; // backward compat
      request.active_business_id = payload.business_id ?? null;

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired session token.');
    }
  }
}
