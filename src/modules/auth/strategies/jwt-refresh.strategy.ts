import {
  // ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../../database/entities';
import { TokenBlocklistService } from '../token-blocklist.service';

function extractRefreshFromCookie(req: Request): string | null {
  const token = req.cookies?.refresh_token as string | undefined;
  return token || null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tokenBlocklist: TokenBlocklistService,
  ) {
    super({
      jwtFromRequest: extractRefreshFromCookie,
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.refreshSecret') ||
        'fallback-refresh-secret',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    type: string;
    jti?: string;
    sid?: string;
    mode?: 'live' | 'test';
    business_id?: string | null;
  }) {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type.');
      // throw new ForbiddenException('Invalid token type.');
    }

    if (payload.jti && (await this.tokenBlocklist.isRevoked(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked.');
      // throw new ForbiddenException('Token has been revoked.');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, status: UserStatus.ACTIVE },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or inactive account.');
      // throw new ForbiddenException('Invalid or inactive account.');
    }

    return Object.assign(user, {
      mode: payload.mode ?? 'test',
      active_business_id: payload.business_id ?? null,
      session_id: payload.sid,
    });
  }
}
