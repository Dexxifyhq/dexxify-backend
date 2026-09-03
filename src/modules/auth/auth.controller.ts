import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthService, type AuthenticatedUser } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SwitchModeDto,
  SelectBusinessDto,
} from './dto';
import { Public, CookieAuth, GetUser } from '../../common/decorators';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@CookieAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Register new developer',
    description: 'Register a new developer account with email verification',
  })
  @Public()
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verify email using one-time password sent during registration',
  })
  @Public()
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.verifyOtp(dto, res, req);
  }

  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Resend one-time password for email verification',
  })
  @Public()
  @Throttle({ global: { limit: 3, ttl: 60000 } })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @ApiOperation({
    summary: 'Forgot password',
    description: 'Request password reset link via email',
  })
  @Public()
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using token from forgot password email',
  })
  @Public()
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({
    summary: 'Login',
    description: 'Authenticate developer and set refresh token cookie',
  })
  @Public()
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, res, req);
  }

  @ApiOperation({
    summary: 'Refresh token',
    description: 'Get new access token using refresh token cookie',
  })
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @GetUser() developer: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.refresh(developer, res, req);
  }

  @ApiOperation({
    summary: 'Select active business',
    description:
      'Activate a specific business workspace. Required after login when the developer owns multiple businesses. Issues a new JWT with the selected business_id embedded.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('select-business')
  @HttpCode(HttpStatus.OK)
  async selectBusiness(
    @GetUser() developer: AuthenticatedUser,
    @Body() dto: SelectBusinessDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.selectBusiness(developer, dto, res, req);
  }

  @ApiOperation({
    summary: 'Switch environment mode',
    description:
      'Switch between live and test mode. Issues a new JWT with the updated mode claim and refreshes the cookie.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('mode')
  @HttpCode(HttpStatus.OK)
  switchMode(
    @GetUser() developer: AuthenticatedUser,
    @Body() dto: SwitchModeDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.switchMode(developer, dto.mode, res, req);
  }

  @ApiOperation({
    summary: 'Logout',
    description: 'Clear authentication cookies and logout developer',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(req, res);
  }

  @ApiOperation({
    summary: 'Logout all devices',
    description:
      'Revoke every active session for this account — every device, every browser, including this one.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @GetUser() developer: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logoutAll(developer, res);
  }

  @ApiOperation({
    summary: 'List active sessions',
    description:
      'List every currently active session (login) for this account — device, IP, when it was issued, and which one is this request.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  async listSessions(@GetUser() developer: AuthenticatedUser) {
    return this.authService.listSessions(developer);
  }

  @ApiOperation({
    summary: 'Revoke a single session',
    description:
      "Log out one specific device/session by the id returned from GET /auth/sessions, without affecting the account's other sessions.",
  })
  @UseGuards(AuthGuard('jwt'))
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @GetUser() developer: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.revokeSession(developer, sessionId);
  }

  @ApiOperation({
    summary: 'Get profile',
    description: 'Get authenticated developer profile information',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@GetUser() developer: AuthenticatedUser) {
    return this.authService.getProfile(developer);
  }
}
