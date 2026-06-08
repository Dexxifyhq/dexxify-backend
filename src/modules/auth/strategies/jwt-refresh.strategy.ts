import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Developer, DeveloperStatus } from '../../../database/entities';

/**
 * Extracts refresh token from http-only cookie named 'refresh_token'.
 */
function extractRefreshFromCookie(req: Request): string | null {
  return req?.cookies?.refresh_token || null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    @InjectRepository(Developer)
    private readonly developerRepo: Repository<Developer>,
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
    mode?: 'live' | 'test';
  }) {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const developer = await this.developerRepo.findOne({
      where: { id: payload.sub, status: DeveloperStatus.ACTIVE },
    });

    if (!developer) {
      throw new UnauthorizedException('Invalid or inactive account.');
    }

    return Object.assign(developer, { mode: payload.mode ?? 'test' });
  }
}
