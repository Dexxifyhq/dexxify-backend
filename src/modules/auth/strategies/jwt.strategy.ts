import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Developer, DeveloperStatus } from '../../../database/entities';

/**
 * Extracts JWT access token from http-only cookie named 'access_token'.
 */
function extractFromCookie(req: Request): string | null {
  return req?.cookies?.access_token || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(Developer)
    private readonly developerRepo: Repository<Developer>,
  ) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'fallback-secret',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    type: string;
    mode?: 'live' | 'test';
  }) {
    if (payload.type !== 'access') {
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
