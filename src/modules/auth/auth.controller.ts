import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SwitchModeDto,
} from './dto';
import { Public, CookieAuth, GetDeveloper } from '../../common/decorators';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

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
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyOtp(dto, res);
  }

  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Resend one-time password for email verification',
  })
  @Public()
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
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, res);
  }

  @ApiOperation({
    summary: 'Refresh token',
    description: 'Get new access token using refresh token cookie',
  })
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetDeveloper() developer: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(developer, res);
  }

  @ApiOperation({
    summary: 'Switch environment mode',
    description:
      'Switch between live and test mode. Issues a new JWT with the updated mode claim and refreshes the cookie.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('mode')
  @HttpCode(HttpStatus.OK)
  async switchMode(
    @GetDeveloper() developer: any,
    @Body() dto: SwitchModeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.switchMode(developer, dto.mode, res);
  }

  @ApiOperation({
    summary: 'Logout',
    description: 'Clear authentication cookies and logout developer',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @ApiOperation({
    summary: 'Get profile',
    description: 'Get authenticated developer profile information',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@GetDeveloper() developer: any) {
    return this.authService.getProfile(developer);
  }
}
