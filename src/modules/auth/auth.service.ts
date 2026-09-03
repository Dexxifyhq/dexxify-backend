import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Response, Request, CookieOptions } from 'express';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { TokenBlocklistService } from './token-blocklist.service';
import {
  User,
  UserStatus,
  BusinessUser,
  BusinessRole,
  BusinessUserStatus,
  Business,
  ApiKey,
  OtpCode,
  OtpType,
  SettlementCurrency,
  PayoutMethod,
} from '../../database/entities';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SelectBusinessDto,
} from './dto';
import { generateApiKey, generateOtp, hashOtp } from '../../common/utils';
import { MailService } from '../mail/mail.service';

export interface BusinessSummary {
  id: string;
  name: string;
  logo_url: string | null;
}

export type AuthenticatedUser = User & {
  mode?: 'live' | 'test';
  active_business_id?: string | null;
  session_id?: string;
};

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;
  private readonly isProduction: boolean;
  private readonly otpExpiryMinutes: number;
  private readonly otpMaxAttempts: number;
  private readonly otpResendCooldown: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(BusinessUser)
    private readonly businessUserRepo: Repository<BusinessUser>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(OtpCode) private readonly otpRepo: Repository<OtpCode>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly tokenBlocklist: TokenBlocklistService,
  ) {
    this.jwtSecret = this.config.get<string>('jwt.secret') || 'fallback-secret';
    this.jwtExpiresIn = this.config.get<string>('jwt.expiresIn') || '1800s';
    this.refreshSecret =
      this.config.get<string>('jwt.refreshSecret') || 'fallback-refresh-secret';
    this.refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn') || '1d';
    this.isProduction = this.config.get<string>('app.nodeEnv') === 'production';
    this.otpExpiryMinutes = this.config.get<number>('otp.expiryMinutes') || 10;
    this.otpMaxAttempts = this.config.get<number>('otp.maxAttempts') || 5;
    this.otpResendCooldown =
      this.config.get<number>('otp.resendCooldownSeconds') || 60;
  }

  // ── Register ───────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing && existing.status !== UserStatus.PENDING) {
      throw new ConflictException('An account with this email already exists.');
    }

    let user: User;

    if (existing && existing.status === UserStatus.PENDING) {
      existing.password_hash = await bcrypt.hash(dto.password, 12);
      existing.first_name = dto.first_name;
      existing.last_name = dto.last_name;
      if (dto.phone) existing.phone = dto.phone;
      user = await this.userRepo.save(existing);
    } else {
      user = this.userRepo.create({
        email: dto.email,
        password_hash: await bcrypt.hash(dto.password, 12),
        status: UserStatus.PENDING,
        first_name: dto.first_name,
        last_name: dto.last_name,
        ...(dto.phone ? { phone: dto.phone } : {}),
      });
      user = await this.userRepo.save(user);
      await this.createBusinessForUser(user);
    }

    await this.invalidateOldOtps(user.id, OtpType.EMAIL_VERIFICATION);
    await this.createAndSendOtp(user, OtpType.EMAIL_VERIFICATION);

    return {
      message:
        'Registration successful. Please check your email for the verification code.',
      email: user.email,
    };
  }

  private async createBusinessForUser(user: User): Promise<Business> {
    const business = await this.businessRepo.save(
      this.businessRepo.create({
        owner_user_id: user.id,
        name: `${user.first_name}'s Business`,
        email: user.email,
        settlement_currency: SettlementCurrency.USDT,
        default_payout_method: PayoutMethod.CRYPTO,
        notification_preferences: {
          email_notifications: true,
          low_balance_alerts: false,
          automated_receipts: true,
          invoice_followups: true,
        },
      }),
    );

    await this.businessUserRepo.save(
      this.businessUserRepo.create({
        user_id: user.id,
        business_id: business.id,
        role: BusinessRole.OWNER,
        status: BusinessUserStatus.ACTIVE,
        joined_at: new Date(),
      }),
    );

    await this.userRepo.update(user.id, {
      last_active_business_id: business.id,
    });
    user.last_active_business_id = business.id;

    return business;
  }

  // ── Verify OTP ─────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto, res: Response, req?: Request) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('No account found with this email.');
    }

    if (user.status === UserStatus.ACTIVE && user.email_verified_at) {
      throw new BadRequestException('Email is already verified.');
    }

    const otpRecord = await this.otpRepo.findOne({
      where: {
        user_id: user.id,
        type: OtpType.EMAIL_VERIFICATION,
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'OTP has expired or is invalid. Please request a new one.',
      );
    }

    if (otpRecord.attempts >= this.otpMaxAttempts) {
      throw new BadRequestException(
        'Too many failed attempts. Please request a new verification code.',
      );
    }

    otpRecord.attempts += 1;
    await this.otpRepo.save(otpRecord);

    const codeHash = hashOtp(dto.code);
    if (codeHash !== otpRecord.code_hash) {
      const remaining = this.otpMaxAttempts - otpRecord.attempts;
      throw new BadRequestException(
        `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      );
    }

    otpRecord.is_used = true;
    await this.otpRepo.save(otpRecord);

    user.status = UserStatus.ACTIVE;
    user.email_verified_at = new Date();
    await this.userRepo.save(user);

    const businessId = user.last_active_business_id;
    if (!businessId)
      throw new BadRequestException('No business found for user.');

    const { key, prefix, hash } = generateApiKey('test');
    await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        user_id: user.id,
        business_id: businessId,
        key_hash: hash,
        key_prefix: prefix,
        label: 'Default Test Key',
        mode: 'test',
      }),
    );

    this.setTokenCookies(res, user, 'test', businessId, req);

    return {
      message: 'Email verified successfully.',
      user: this.sanitizeUser(user),
      api_key: key,
    };
  }

  // ── Resend OTP ─────────────────────────────────────────

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user) {
      return {
        message: 'If an account exists, a verification code has been sent.',
      };
    }

    if (user.status === UserStatus.ACTIVE && user.email_verified_at) {
      throw new BadRequestException('Email is already verified.');
    }

    const recentOtp = await this.otpRepo.findOne({
      where: { user_id: user.id, type: OtpType.EMAIL_VERIFICATION },
      order: { created_at: 'DESC' },
    });

    if (recentOtp) {
      const elapsed =
        (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
      if (elapsed < this.otpResendCooldown) {
        const wait = Math.ceil(this.otpResendCooldown - elapsed);
        throw new BadRequestException(
          `Please wait ${wait} seconds before requesting a new code.`,
        );
      }
    }

    await this.invalidateOldOtps(user.id, OtpType.EMAIL_VERIFICATION);
    await this.createAndSendOtp(user, OtpType.EMAIL_VERIFICATION);

    return {
      message: 'If an account exists, a verification code has been sent.',
    };
  }

  // ── Forgot Password ────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return {
        message:
          'If an account with this email exists, a password reset code has been sent.',
      };
    }

    const recentOtp = await this.otpRepo.findOne({
      where: { user_id: user.id, type: OtpType.PASSWORD_RESET },
      order: { created_at: 'DESC' },
    });

    if (recentOtp) {
      const elapsed =
        (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
      if (elapsed < this.otpResendCooldown) {
        const wait = Math.ceil(this.otpResendCooldown - elapsed);
        throw new BadRequestException(
          `Please wait ${wait} seconds before requesting a new code.`,
        );
      }
    }

    await this.invalidateOldOtps(user.id, OtpType.PASSWORD_RESET);
    await this.createAndSendOtp(user, OtpType.PASSWORD_RESET);

    return {
      message:
        'If an account with this email exists, a password reset code has been sent.',
    };
  }

  // ── Reset Password ─────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user) throw new BadRequestException('Invalid request.');

    const otpRecord = await this.otpRepo.findOne({
      where: {
        user_id: user.id,
        type: OtpType.PASSWORD_RESET,
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'Reset code has expired or is invalid. Please request a new one.',
      );
    }

    if (otpRecord.attempts >= this.otpMaxAttempts) {
      throw new BadRequestException(
        'Too many failed attempts. Please request a new reset code.',
      );
    }

    otpRecord.attempts += 1;
    await this.otpRepo.save(otpRecord);

    const codeHash = hashOtp(dto.code);
    if (codeHash !== otpRecord.code_hash) {
      const remaining = this.otpMaxAttempts - otpRecord.attempts;
      throw new BadRequestException(
        `Invalid reset code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      );
    }

    otpRecord.is_used = true;
    await this.otpRepo.save(otpRecord);

    user.password_hash = await bcrypt.hash(dto.new_password, 12);
    await this.userRepo.save(user);

    await this.invalidateOldOtps(user.id, OtpType.PASSWORD_RESET);

    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  // ── Login ──────────────────────────────────────────────

  async login(dto: LoginDto, res: Response, req?: Request) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user || !user.password_hash)
      throw new UnauthorizedException('Invalid email or password.');

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!passwordValid)
      throw new UnauthorizedException('Invalid email or password.');

    if (user.status === UserStatus.PENDING) {
      await this.invalidateOldOtps(user.id, OtpType.EMAIL_VERIFICATION);
      await this.createAndSendOtp(user, OtpType.EMAIL_VERIFICATION);

      throw new UnauthorizedException({
        message:
          'Please verify your email first. A new verification code has been sent.',
        email_verification_required: true,
        email: user.email,
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended. Contact support.');
    }

    // Resolve active business
    let businessId = user.last_active_business_id;

    if (!businessId) {
      // Fallback: find first owned business or any membership
      const membership = await this.businessUserRepo.findOne({
        where: { user_id: user.id, status: BusinessUserStatus.ACTIVE },
        order: { joined_at: 'ASC' },
      });
      if (membership) {
        businessId = membership.business_id;
        await this.userRepo.update(user.id, {
          last_active_business_id: businessId,
        });
      } else {
        const business = await this.createBusinessForUser(user);
        businessId = business.id;
      }
    }

    const business = businessId
      ? await this.businessRepo.findOne({
          where: { id: businessId },
          select: ['id', 'name', 'logo_url'],
        })
      : null;

    this.setTokenCookies(res, user, 'test', businessId, req);

    return {
      user: this.sanitizeUser(user),
      business,
    };
  }

  // ── Select Business ────────────────────────────────────

  async selectBusiness(
    user: AuthenticatedUser,
    dto: SelectBusinessDto,
    res: Response,
    req?: Request,
  ) {
    const membership = await this.businessUserRepo.findOne({
      where: {
        user_id: user.id,
        business_id: dto.business_id,
        status: BusinessUserStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Business not found or access denied.');
    }

    const business = await this.businessRepo.findOne({
      where: { id: dto.business_id },
      select: ['id', 'name', 'logo_url'],
    });

    if (!business) throw new ForbiddenException('Business not found.');

    await this.userRepo.update(user.id, {
      last_active_business_id: dto.business_id,
    });

    const mode: 'live' | 'test' = user.mode ?? 'test';
    this.setTokenCookies(
      res,
      user,
      mode,
      dto.business_id,
      req,
      user.session_id,
    );
    return { business };
  }

  // ── Refresh, Logout, Profile ───────────────────────────

  refresh(user: AuthenticatedUser, res: Response, req?: Request) {
    this.setTokenCookies(
      res,
      user,
      user.mode ?? 'test',
      user.active_business_id ?? null,
      req,
      user.session_id,
    );
    return { user: this.sanitizeUser(user) };
  }

  switchMode(
    user: AuthenticatedUser,
    mode: 'live' | 'test',
    res: Response,
    req?: Request,
  ) {
    this.setTokenCookies(
      res,
      user,
      mode,
      user.active_business_id ?? null,
      req,
      user.session_id,
    );
    return {
      mode,
      user: this.sanitizeUser(user),
    };
  }

  async logout(req: Request, res: Response) {
    const accessToken = req.cookies?.access_token as string | undefined;
    const refreshToken = req.cookies?.refresh_token as string | undefined;

    await Promise.all([
      this.revokeTokenIfPresent(accessToken),
      this.revokeTokenIfPresent(refreshToken),
    ]);

    this.clearAuthCookies(res);
    return { message: 'Logged out successfully.' };
  }

  /** Revoke every session this user has — every device, every browser. */
  async logoutAll(user: AuthenticatedUser, res: Response) {
    const revokedCount = await this.tokenBlocklist.revokeAllForUser(user.id);

    this.clearAuthCookies(res);
    return {
      message: 'Logged out of all devices.',
      revoked_sessions: revokedCount,
    };
  }

  async listSessions(user: AuthenticatedUser) {
    const sessions = await this.tokenBlocklist.listSessions(
      user.id,
      user.session_id,
    );
    return { data: sessions };
  }

  async revokeSession(user: AuthenticatedUser, sessionId: string) {
    const revoked = await this.tokenBlocklist.revokeSession(user.id, sessionId);
    if (!revoked) throw new BadRequestException('Session not found.');
    return { message: 'Session revoked.' };
  }

  private clearAuthCookies(res: Response) {
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      domain: this.isProduction ? '.dexxify.com' : undefined,
      path: '/',
    };
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
  }

  /** Blocklist a token's jti until it would have expired anyway. */
  private async revokeTokenIfPresent(token: string | undefined) {
    if (!token) return;

    const decoded = this.jwtService.decode<{
      jti?: string;
      exp?: number;
    } | null>(token);

    if (!decoded?.jti || !decoded.exp) return;

    const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
    await this.tokenBlocklist.revoke(decoded.jti, remainingSeconds);
  }

  async getProfile(user: AuthenticatedUser) {
    const found = await this.userRepo.findOne({ where: { id: user.id } });
    if (!found) throw new UnauthorizedException('User not found.');
    return this.sanitizeUser({ ...found, mode: user.mode });
  }

  // ── Internal helpers ───────────────────────────────────

  private async createAndSendOtp(user: User, type: OtpType) {
    const { code, hash } = generateOtp();

    await this.otpRepo.save(
      this.otpRepo.create({
        user_id: user.id,
        code_hash: hash,
        type,
        expires_at: new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000),
      }),
    );

    const name = `${user.first_name} ${user.last_name}`;

    if (type === OtpType.PASSWORD_RESET) {
      await this.mailService.sendPasswordResetEmail(user.email, code, name);
    } else {
      await this.mailService.sendOtpEmail(user.email, code, name);
    }
  }

  private async invalidateOldOtps(userId: string, type: OtpType) {
    await this.otpRepo.update(
      { user_id: userId, type, is_used: false },
      { is_used: true },
    );
  }

  private setTokenCookies(
    res: Response,
    user: User,
    mode: 'live' | 'test' = 'test',
    businessId: string | null = null,
    req?: Request,
    sessionId?: string,
  ) {
    // Reuse the caller's existing session id when we're continuing a
    // session (refresh/select-business/switch-mode); generate a fresh one
    // only for an actual new login (login/verify-otp pass nothing).
    const sid = sessionId ?? randomUUID();

    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      mode,
    };
    if (businessId) payload.business_id = businessId;

    const accessSignOptions: JwtSignOptions = {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn as JwtSignOptions['expiresIn'],
    };
    const refreshSignOptions: JwtSignOptions = {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as JwtSignOptions['expiresIn'],
    };
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access', jti: accessJti, sid },
      accessSignOptions,
    );
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: refreshJti, sid },
      refreshSignOptions,
    );

    // Track this session against the user so it shows up in listSessions()
    // and can be revoked later (individually or via logoutAll) — fire and
    // forget, a tracking hiccup shouldn't block login.
    const now = Math.floor(Date.now() / 1000);
    const userAgentHeader: string | string[] | undefined =
      req?.headers['user-agent'];
    void this.tokenBlocklist.trackSession(user.id, sid, {
      accessJti,
      refreshJti,
      issuedAt: now,
      accessExpiresAt:
        now + Math.floor(this.parseExpiryToMs(this.jwtExpiresIn) / 1000),
      refreshExpiresAt:
        now + Math.floor(this.parseExpiryToMs(this.refreshExpiresIn) / 1000),
      ip: req?.ip,
      userAgent: Array.isArray(userAgentHeader)
        ? String(userAgentHeader[0])
        : userAgentHeader,
    });

    const cookieBase: CookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      domain: this.isProduction ? '.dexxify.com' : undefined,
      path: '/',
    };

    res.cookie('access_token', accessToken, {
      ...cookieBase,
      maxAge: this.parseExpiryToMs(this.jwtExpiresIn),
    });
    res.cookie('refresh_token', refreshToken, {
      ...cookieBase,
      maxAge: this.parseExpiryToMs(this.refreshExpiresIn),
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 30 * 60 * 1000;
    const v = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return v * 1000;
      case 'm':
        return v * 60 * 1000;
      case 'h':
        return v * 60 * 60 * 1000;
      case 'd':
        return v * 24 * 60 * 60 * 1000;
      default:
        return 30 * 60 * 1000;
    }
  }

  private sanitizeUser<T extends { password_hash?: string | null }>(
    user: T,
  ): Omit<T, 'password_hash'> {
    const { password_hash, ...safe } = user;
    void password_hash;
    return safe;
  }
}
