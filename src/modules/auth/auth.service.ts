import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import {
  Developer,
  DeveloperStatus,
  ApiKey,
  OtpCode,
  OtpType,
} from '../../database/entities';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { generateApiKey, generateOtp, hashOtp } from '../../common/utils';
import { MailService } from '../mail/mail.service';

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
    @InjectRepository(Developer)
    private readonly developerRepo: Repository<Developer>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(OtpCode) private readonly otpRepo: Repository<OtpCode>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
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

  // ── Register — creates PENDING account, sends OTP ─────

  async register(dto: RegisterDto) {
    const existing = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (existing && existing.status !== DeveloperStatus.PENDING) {
      throw new ConflictException(
        'A developer account with this email already exists.',
      );
    }

    let developer: Developer;

    if (existing && existing.status === DeveloperStatus.PENDING) {
      existing.password_hash = await bcrypt.hash(dto.password, 12);
      existing.first_name = dto.first_name;
      existing.last_name = dto.last_name;
      existing.business_name = dto.business_name;
      if (dto.business_type) existing.business_type = dto.business_type;
      if (dto.phone) existing.phone = dto.phone;
      developer = await this.developerRepo.save(existing);
    } else {
      const newDev: Partial<Developer> = {
        email: dto.email,
        password_hash: await bcrypt.hash(dto.password, 12),
        business_name: dto.business_name,
        status: DeveloperStatus.PENDING,
        first_name: dto.first_name,
        last_name: dto.last_name,
      };
      if (dto.business_type) newDev.business_type = dto.business_type;
      if (dto.phone) newDev.phone = dto.phone;

      developer = this.developerRepo.create(newDev as Developer);
      await this.developerRepo.save(developer);
    }

    await this.invalidateOldOtps(developer.id, OtpType.EMAIL_VERIFICATION);
    await this.createAndSendOtp(developer, OtpType.EMAIL_VERIFICATION);

    return {
      message:
        'Registration successful. Please check your email for the verification code.',
      email: developer.email,
    };
  }

  // ── Verify OTP — activates account, sets cookies ──────

  async verifyOtp(dto: VerifyOtpDto, res: Response) {
    const developer = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (!developer) {
      throw new BadRequestException('No account found with this email.');
    }

    if (
      developer.status === DeveloperStatus.ACTIVE &&
      developer.email_verified_at
    ) {
      throw new BadRequestException('Email is already verified.');
    }

    const otpRecord = await this.otpRepo.findOne({
      where: {
        developer_id: developer.id,
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

    // Success — activate account
    otpRecord.is_used = true;
    await this.otpRepo.save(otpRecord);

    developer.status = DeveloperStatus.ACTIVE;
    developer.email_verified_at = new Date();
    await this.developerRepo.save(developer);

    const { key, prefix, hash } = generateApiKey('sandbox');
    await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        developer_id: developer.id,
        key_hash: hash,
        key_prefix: prefix,
        label: 'Default Sandbox Key',
        environment: 'sandbox',
      }),
    );

    this.setTokenCookies(res, developer);

    return {
      message: 'Email verified successfully.',
      developer: this.sanitizeDeveloper(developer),
      api_key: key,
    };
  }

  // ── Resend OTP ────────────────────────────────────────

  async resendOtp(dto: ResendOtpDto) {
    const developer = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (!developer) {
      return {
        message: 'If an account exists, a verification code has been sent.',
      };
    }

    if (
      developer.status === DeveloperStatus.ACTIVE &&
      developer.email_verified_at
    ) {
      throw new BadRequestException('Email is already verified.');
    }

    const recentOtp = await this.otpRepo.findOne({
      where: { developer_id: developer.id, type: OtpType.EMAIL_VERIFICATION },
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

    await this.invalidateOldOtps(developer.id, OtpType.EMAIL_VERIFICATION);
    await this.createAndSendOtp(developer, OtpType.EMAIL_VERIFICATION);

    return {
      message: 'If an account exists, a verification code has been sent.',
    };
  }

  // ── Forgot Password — sends password reset OTP ────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const developer = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    // Always return same message — don't reveal whether account exists
    if (!developer) {
      return {
        message:
          'If an account with this email exists, a password reset code has been sent.',
      };
    }

    // Only allow password reset for active, verified accounts
    if (developer.status !== DeveloperStatus.ACTIVE) {
      return {
        message:
          'If an account with this email exists, a password reset code has been sent.',
      };
    }

    // Check cooldown
    const recentOtp = await this.otpRepo.findOne({
      where: { developer_id: developer.id, type: OtpType.PASSWORD_RESET },
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

    // Invalidate old password reset OTPs and send new one
    await this.invalidateOldOtps(developer.id, OtpType.PASSWORD_RESET);
    await this.createAndSendOtp(developer, OtpType.PASSWORD_RESET);

    return {
      message:
        'If an account with this email exists, a password reset code has been sent.',
    };
  }

  // ── Reset Password — verify OTP + set new password ────

  async resetPassword(dto: ResetPasswordDto) {
    const developer = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (!developer) {
      throw new BadRequestException('Invalid request.');
    }

    // Find latest unused, unexpired password reset OTP
    const otpRecord = await this.otpRepo.findOne({
      where: {
        developer_id: developer.id,
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

    // Increment attempts
    otpRecord.attempts += 1;
    await this.otpRepo.save(otpRecord);

    // Verify code
    const codeHash = hashOtp(dto.code);
    if (codeHash !== otpRecord.code_hash) {
      const remaining = this.otpMaxAttempts - otpRecord.attempts;
      throw new BadRequestException(
        `Invalid reset code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      );
    }

    // Success — update password
    otpRecord.is_used = true;
    await this.otpRepo.save(otpRecord);

    developer.password_hash = await bcrypt.hash(dto.new_password, 12);
    await this.developerRepo.save(developer);

    // Invalidate any remaining password reset OTPs
    await this.invalidateOldOtps(developer.id, OtpType.PASSWORD_RESET);

    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  // ── Login — blocks unverified accounts ────────────────

  async login(dto: LoginDto, res: Response) {
    const developer = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (!developer) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      developer.password_hash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (developer.status === DeveloperStatus.PENDING) {
      await this.invalidateOldOtps(developer.id, OtpType.EMAIL_VERIFICATION);
      await this.createAndSendOtp(developer, OtpType.EMAIL_VERIFICATION);

      throw new UnauthorizedException({
        message:
          'Please verify your email first. A new verification code has been sent.',
        email_verification_required: true,
        email: developer.email,
      });
    }

    if (developer.status === DeveloperStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended. Contact support.');
    }

    this.setTokenCookies(res, developer);
    return { developer: this.sanitizeDeveloper(developer) };
  }

  // ── Refresh, Logout, Profile ──────────────────────────

  async refresh(developer: Developer, res: Response) {
    this.setTokenCookies(res, developer);
    return { developer: this.sanitizeDeveloper(developer) };
  }

  async logout(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully.' };
  }

  async getProfile(developerId: string) {
    const developer = await this.developerRepo.findOne({
      where: { id: developerId },
    });
    if (!developer) throw new UnauthorizedException('Developer not found.');
    return this.sanitizeDeveloper(developer);
  }

  // ── Internal helpers ──────────────────────────────────

  private async createAndSendOtp(developer: Developer, type: OtpType) {
    const { code, hash } = generateOtp();

    await this.otpRepo.save(
      this.otpRepo.create({
        developer_id: developer.id,
        code_hash: hash,
        type,
        expires_at: new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000),
      }),
    );

    const name = `${developer.first_name} ${developer.last_name}`;

    if (type === OtpType.PASSWORD_RESET) {
      await this.mailService.sendPasswordResetEmail(
        developer.email,
        code,
        name,
      );
    } else {
      await this.mailService.sendOtpEmail(developer.email, code, name);
    }
  }

  private async invalidateOldOtps(developerId: string, type: OtpType) {
    await this.otpRepo.update(
      { developer_id: developerId, type, is_used: false },
      { is_used: true },
    );
  }

  private setTokenCookies(res: Response, developer: Developer) {
    const payload = { sub: developer.id, email: developer.email };

    const accessToken = this.jwtService.sign({ ...payload, type: 'access' }, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn,
    } as any);
    const refreshToken = this.jwtService.sign({ ...payload, type: 'refresh' }, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    } as any);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      domain: this.isProduction ? '.dexxify.com' : undefined,
      maxAge: this.parseExpiryToMs(this.jwtExpiresIn),
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      domain: this.isProduction ? '.dexxify.com' : undefined,
      maxAge: this.parseExpiryToMs(this.refreshExpiresIn),
      // path: '/auth/refresh',
    });
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

  private sanitizeDeveloper(developer: Developer) {
    const { password_hash, ...safe } = developer;
    return safe;
  }
}
