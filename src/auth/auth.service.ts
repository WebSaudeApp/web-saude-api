import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { toUserResponse } from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  addDuration,
  durationToSeconds,
  generateEmailCode,
  generateRefreshToken,
  generateResetToken,
  hashSha256,
  sha256Matches,
} from './crypto/token.util';

const BCRYPT_ROUNDS = 10;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_RESEND_MAX_PER_HOUR = 3;
const GENERIC_AUTH_ERROR = 'Credenciais inválidas.';

type SessionMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: SessionMeta,
  ): Promise<AuthTokensDto & { debugCode?: string }> {
    this.usersService.assertNotAdminRole(dto.role);

    const email = dto.email.toLowerCase();
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Este e-mail já está em uso.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
      },
    });

    const debugCode = await this.issueEmailVerification(user.id);
    const tokens = await this.issueSession(user, meta);

    return this.withDebugCode(tokens, debugCode);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthTokensDto> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user || !user.isActive) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    return this.issueSession(user, meta);
  }

  async refresh(dto: RefreshDto, meta: SessionMeta): Promise<AuthTokensDto> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashSha256(dto.refreshToken) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now() ||
      session.user.deletedAt ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(session.user, meta);
  }

  async logout(dto: RefreshDto): Promise<{ message: string }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashSha256(dto.refreshToken) },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Sessão encerrada.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user) {
      throw new BadRequestException('Código inválido.');
    }

    if (user.emailVerified) {
      return { message: 'E-mail já verificado.' };
    }

    const verification = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification || verification.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Código expirado ou inválido.');
    }

    if (verification.attempts >= EMAIL_MAX_ATTEMPTS) {
      throw new BadRequestException('Número de tentativas excedido.');
    }

    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    if (!sha256Matches(dto.code, verification.codeHash)) {
      throw new BadRequestException('Código inválido.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'E-mail verificado.' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string; debugCode?: string }> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user) {
      return { message: 'Se o e-mail existir, enviaremos um novo código.' };
    }

    if (user.emailVerified) {
      throw new BadRequestException('E-mail já verificado.');
    }

    const latest = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException('Aguarde para reenviar o código.');
    }

    const recentCount = await this.prisma.emailVerification.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentCount >= EMAIL_RESEND_MAX_PER_HOUR) {
      throw new BadRequestException('Limite de reenvio atingido.');
    }

    const debugCode = await this.issueEmailVerification(user.id);
    return this.withDebugCode(
      { message: 'Se o e-mail existir, enviaremos um novo código.' },
      debugCode,
    );
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; debugToken?: string }> {
    const message =
      'Se o e-mail existir, enviaremos instruções para redefinir a senha.';
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user) {
      return { message };
    }

    const token = generateResetToken();
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashSha256(token),
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
      },
    });

    if (this.isProduction()) {
      return { message };
    }

    return { message, debugToken: token };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashSha256(dto.token) },
    });

    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token de recuperação inválido.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Senha atualizada.' };
  }

  private async issueEmailVerification(userId: string): Promise<string> {
    const code = generateEmailCode();
    await this.prisma.emailVerification.create({
      data: {
        userId,
        codeHash: hashSha256(code),
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
      },
    });
    return code;
  }

  private async issueSession(
    user: User,
    meta: SessionMeta,
  ): Promise<AuthTokensDto> {
    const refreshToken = generateRefreshToken();
    const refreshExpires = addDuration(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES'),
    );

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashSha256(refreshToken),
        expiresAt: refreshExpires,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const accessExpires =
      this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES');
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: durationToSeconds(accessExpires),
      user: toUserResponse(user),
    };
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private withDebugCode<T extends object>(
    payload: T,
    debugCode: string,
  ): T & { debugCode?: string } {
    if (this.isProduction()) {
      return payload;
    }
    return { ...payload, debugCode };
  }
}
