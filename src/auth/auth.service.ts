import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PapelUsuario, StatusUsuario, Usuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../database/prisma.service';
import { AuthTokensDto, paraUsuarioResposta } from './dto/auth-tokens.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  addDuration,
  durationToSeconds,
  generateRefreshToken,
  hashSha256,
} from './crypto/token.util';

const BCRYPT_ROUNDS = 10;
const ERRO_CREDENCIAS_INVALIDAS = 'Credenciais inválidas.';
// Hash fictício de 60 chars para mitigar timing attack em usuário inexistente
const HASH_DUMMY =
  '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12';

export interface MetadadosRequisicao {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client();
  }

  async register(
    dto: RegisterDto,
    meta: MetadadosRequisicao = {},
  ): Promise<AuthTokensDto> {
    if (
      dto.papel !== PapelUsuario.PACIENTE &&
      dto.papel !== PapelUsuario.GESTOR
    ) {
      throw new BadRequestException(
        'O cadastro aceita somente os papéis PACIENTE ou GESTOR.',
      );
    }

    const email = dto.email.trim().toLowerCase();

    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new ConflictException('Este e-mail já está em uso.');
    }

    const senhaHash = await bcrypt.hash(dto.senha, BCRYPT_ROUNDS);

    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome.trim(),
        email,
        telefone: dto.telefone?.trim() || null,
        senhaHash,
        papel: dto.papel,
        status: StatusUsuario.ATIVO,
      },
    });

    return this.gerarSessaoETokens(usuario, meta);
  }

  async login(
    dto: LoginDto,
    meta: MetadadosRequisicao = {},
  ): Promise<AuthTokensDto> {
    const email = dto.email.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    // Se o usuário não existe, está inativo, desativado ou não possui senha (ex: conta Google),
    // executamos compare fictício para mitigar timing attack e retornamos erro padronizado.
    if (
      !usuario ||
      usuario.status !== StatusUsuario.ATIVO ||
      usuario.desativadoEm !== null ||
      !usuario.senhaHash
    ) {
      await bcrypt.compare(dto.senha, HASH_DUMMY);
      throw new UnauthorizedException(ERRO_CREDENCIAS_INVALIDAS);
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException(ERRO_CREDENCIAS_INVALIDAS);
    }

    return this.gerarSessaoETokens(usuario, meta);
  }

  async loginComGoogle(
    dto: GoogleLoginDto,
    meta: MetadadosRequisicao = {},
  ): Promise<AuthTokensDto> {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new BadRequestException(
        'Autenticação com Google não está configurada no servidor.',
      );
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token do Google inválido ou expirado.');
    }

    if (!payload || !payload.email || !payload.sub) {
      throw new UnauthorizedException(
        'Token do Google não contém dados de identificação.',
      );
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException(
        'O e-mail do Google precisa estar verificado.',
      );
    }

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const nome = payload.name || payload.given_name || email.split('@')[0];

    // 1. Procurar se já existe usuário por googleId ou email
    let usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (usuario) {
      if (
        usuario.status !== StatusUsuario.ATIVO ||
        usuario.desativadoEm !== null
      ) {
        throw new UnauthorizedException(
          'Esta conta de usuário está inativa ou desativada.',
        );
      }

      // Se o usuário já existia por email mas ainda não tinha o googleId vinculado
      if (!usuario.googleId) {
        usuario = await this.prisma.usuario.update({
          where: { id: usuario.id },
          data: { googleId },
        });
      }
    } else {
      // 2. Se for novo usuário, cria conta social com papel PACIENTE
      usuario = await this.prisma.usuario.create({
        data: {
          nome: nome.trim(),
          email,
          googleId,
          senhaHash: null,
          papel: PapelUsuario.PACIENTE,
          status: StatusUsuario.ATIVO,
        },
      });
    }

    return this.gerarSessaoETokens(usuario, meta);
  }

  private async gerarSessaoETokens(
    usuario: Usuario,
    meta: MetadadosRequisicao,
  ): Promise<AuthTokensDto> {
    const refreshToken = generateRefreshToken();
    const refreshExpiresStr = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES',
      '7d',
    );
    const expiraEm = addDuration(refreshExpiresStr);

    const sessao = await this.prisma.sessao.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashSha256(refreshToken),
        expiraEm,
        ip: meta.ip || null,
        userAgent: meta.userAgent || null,
      },
    });

    const accessExpiresStr = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES',
      '15m',
    );
    const accessToken = await this.jwtService.signAsync(
      {
        sub: usuario.id,
        email: usuario.email,
        papel: usuario.papel,
        sessaoId: sessao.id,
      },
      {
        expiresIn: accessExpiresStr as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: durationToSeconds(accessExpiresStr),
      usuario: paraUsuarioResposta(usuario),
    };
  }
}
