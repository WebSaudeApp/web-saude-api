import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PapelUsuario, StatusUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    sessao: {
      create: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  const mockUsuario = {
    id: 'user-uuid-1',
    nome: 'Maria Silva',
    email: 'maria@email.com',
    telefone: '81999998888',
    senhaHash: '$2b$10$hashedpassword',
    googleId: null,
    papel: PapelUsuario.PACIENTE,
    status: StatusUsuario.ATIVO,
    criadoEm: new Date('2026-01-01T10:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T10:00:00.000Z'),
    desativadoEm: null,
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sessao: {
        create: jest.fn().mockResolvedValue({ id: 'sessao-uuid-1' }),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt.access.token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, def?: string) => {
        if (key === 'JWT_ACCESS_EXPIRES') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES') return '7d';
        if (key === 'GOOGLE_CLIENT_ID')
          return 'mock-client-id.apps.googleusercontent.com';
        return def;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('deve cadastrar usuário com sucesso para papel PACIENTE', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue(mockUsuario);

      const resultado = await service.register({
        nome: '  Maria Silva  ',
        email: 'MARIA@EMAIL.COM ',
        telefone: '81999998888',
        senha: 'senhaSegura123',
        papel: PapelUsuario.PACIENTE,
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'maria@email.com' },
      });
      expect(prisma.usuario.create).toHaveBeenCalled();
      const chamada = prisma.usuario.create.mock.calls[0] as [
        { data: { nome: string; email: string; papel: PapelUsuario } },
      ];
      expect(chamada[0].data.nome).toBe('Maria Silva');
      expect(chamada[0].data.email).toBe('maria@email.com');
      expect(chamada[0].data.papel).toBe(PapelUsuario.PACIENTE);

      expect(resultado.accessToken).toBe('jwt.access.token');
      expect(resultado.refreshToken).toBeDefined();
      expect(resultado.usuario.id).toBe(mockUsuario.id);
      expect(resultado.usuario.email).toBe(mockUsuario.email);
    });

    it('deve rejeitar tentativa de cadastro com papel ADMINISTRADOR', async () => {
      await expect(
        service.register({
          nome: 'Admin Hacker',
          email: 'admin@hacker.com',
          senha: 'senhaSegura123',
          papel: PapelUsuario.ADMINISTRADOR,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar ConflictException quando o e-mail já estiver cadastrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(mockUsuario);

      await expect(
        service.register({
          nome: 'Maria Outra',
          email: 'maria@email.com',
          senha: 'senhaSegura123',
          papel: PapelUsuario.PACIENTE,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('deve autenticar usuário com credenciais válidas', async () => {
      const senhaValida = 'senhaSegura123';
      const hash = await bcrypt.hash(senhaValida, 10);
      prisma.usuario.findUnique.mockResolvedValue({
        ...mockUsuario,
        senhaHash: hash,
      });

      const resultado = await service.login({
        email: 'maria@email.com',
        senha: senhaValida,
      });

      expect(resultado.accessToken).toBe('jwt.access.token');
      expect(resultado.refreshToken).toBeDefined();
      expect(resultado.usuario.email).toBe(mockUsuario.email);
    });

    it('deve falhar com UnauthorizedException se o e-mail não existir (anti-enumeração)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'inexistente@email.com',
          senha: 'qualquerSenha123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve falhar com UnauthorizedException se a senha for incorreta', async () => {
      const hash = await bcrypt.hash('senhaCorreta123', 10);
      prisma.usuario.findUnique.mockResolvedValue({
        ...mockUsuario,
        senhaHash: hash,
      });

      await expect(
        service.login({
          email: 'maria@email.com',
          senha: 'senhaErrada999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve falhar com UnauthorizedException se o usuário estiver desativado', async () => {
      const hash = await bcrypt.hash('senhaCorreta123', 10);
      prisma.usuario.findUnique.mockResolvedValue({
        ...mockUsuario,
        senhaHash: hash,
        desativadoEm: new Date(),
      });

      await expect(
        service.login({
          email: 'maria@email.com',
          senha: 'senhaCorreta123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve falhar com UnauthorizedException se o usuário não possuir senha cadastrada (ex: conta Google)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...mockUsuario,
        senhaHash: null,
      });

      await expect(
        service.login({
          email: 'maria@email.com',
          senha: 'qualquerSenha123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginComGoogle', () => {
    it('deve falhar com BadRequestException se GOOGLE_CLIENT_ID não estiver configurado', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(
        service.loginComGoogle({ idToken: 'some-token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve falhar com UnauthorizedException se o token do Google for inválido', async () => {
      const googleClient = (
        service as unknown as { googleClient: { verifyIdToken: jest.Mock } }
      ).googleClient;
      googleClient.verifyIdToken = jest
        .fn()
        .mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.loginComGoogle({ idToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve cadastrar novo usuário automaticamente via Google', async () => {
      const googleClient = (
        service as unknown as { googleClient: { verifyIdToken: jest.Mock } }
      ).googleClient;
      googleClient.verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-12345',
          email: 'maria.google@email.com',
          email_verified: true,
          name: 'Maria Google',
        }),
      });

      prisma.usuario.findFirst.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue({
        ...mockUsuario,
        id: 'new-google-user',
        email: 'maria.google@email.com',
        googleId: 'google-sub-12345',
        senhaHash: null,
      });

      const resultado = await service.loginComGoogle({
        idToken: 'valid-token',
      });

      expect(prisma.usuario.create).toHaveBeenCalled();
      const chamadaCriacao = prisma.usuario.create.mock.calls[0] as [
        {
          data: {
            email: string;
            googleId: string;
            senhaHash: null;
            papel: PapelUsuario;
          };
        },
      ];
      expect(chamadaCriacao[0].data.email).toBe('maria.google@email.com');
      expect(chamadaCriacao[0].data.googleId).toBe('google-sub-12345');
      expect(chamadaCriacao[0].data.senhaHash).toBeNull();
      expect(chamadaCriacao[0].data.papel).toBe(PapelUsuario.PACIENTE);
      expect(resultado.accessToken).toBe('jwt.access.token');
      expect(resultado.refreshToken).toBeDefined();
    });

    it('deve vincular googleId se o usuário já existia por e-mail', async () => {
      const googleClient = (
        service as unknown as { googleClient: { verifyIdToken: jest.Mock } }
      ).googleClient;
      googleClient.verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-12345',
          email: 'maria@email.com',
          email_verified: true,
          name: 'Maria Silva',
        }),
      });

      prisma.usuario.findFirst.mockResolvedValue({
        ...mockUsuario,
        googleId: null,
      });
      prisma.usuario.update.mockResolvedValue({
        ...mockUsuario,
        googleId: 'google-sub-12345',
      });

      const resultado = await service.loginComGoogle({
        idToken: 'valid-token',
      });

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: mockUsuario.id },
        data: { googleId: 'google-sub-12345' },
      });
      expect(resultado.accessToken).toBe('jwt.access.token');
    });
  });
});
