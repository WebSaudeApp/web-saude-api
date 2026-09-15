import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('auth')
@Public()
@Throttle({ default: { limit: 8, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria uma conta de PATIENT ou FUNCTIONAL' })
  @ApiOkResponse({ type: AuthTokensDto })
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthTokensDto> {
    return this.authService.register(dto, this.sessionMeta(request));
  }

  @Post('login')
  @ApiOperation({ summary: 'Autentica o usuário e devolve tokens' })
  @ApiOkResponse({ type: AuthTokensDto })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<AuthTokensDto> {
    return this.authService.login(dto, this.sessionMeta(request));
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renova o access token e rotaciona o refresh' })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
  ): Promise<AuthTokensDto> {
    return this.authService.refresh(dto, this.sessionMeta(request));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoga a sessão do refresh token' })
  logout(@Body() dto: RefreshDto): Promise<{ message: string }> {
    return this.authService.logout(dto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Confirma o e-mail com o código recebido' })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ message: string }> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Reenvia o código de verificação de e-mail' })
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicita recuperação de senha' })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Define uma nova senha com o token de recuperação' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  private sessionMeta(request: Request): { ip?: string; userAgent?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0] ??
      request.ip;

    return {
      ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
