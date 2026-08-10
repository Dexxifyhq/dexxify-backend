import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../../database/entities';

function extractFromCookie(req: Request): string | null {
  const token = req.cookies?.access_token as string | undefined;
  return token || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
    business_id?: string | null;
  }) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, status: UserStatus.ACTIVE },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or inactive account.');
    }

    return Object.assign(user, {
      mode: payload.mode ?? 'test',
      active_business_id: payload.business_id ?? null,
    });
  }
}
