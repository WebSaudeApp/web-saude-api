import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailVerification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const usersService = {
    findByEmail: jest.fn(),
    assertNotAdminRole: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_REFRESH_EXPIRES') return '7d';
      if (key === 'JWT_ACCESS_EXPIRES') return '15m';
      return 'value';
    }),
    get: jest.fn().mockReturnValue('test'),
  };

  const user = {
    id: 'user-1',
    name: 'Maria',
    email: 'maria@email.com',
    phone: '81999998888',
    passwordHash: 'hash',
    role: UserRole.PATIENT,
    emailVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.session.create.mockResolvedValue({ id: 'session-1' });
    prisma.$transaction.mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registra paciente e devolve tokens', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);

    const result = await service.register(
      {
        name: 'Maria',
        email: 'maria@email.com',
        phone: '81999998888',
        password: 'senhaSegura1',
        role: UserRole.PATIENT,
      },
      {},
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toHaveLength(96);
    expect(result.user.email).toBe('maria@email.com');
    expect(result.debugCode).toHaveLength(6);
  });

  it('rejeita senha incorreta no login', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash('outraSenha1', 10),
    });

    await expect(
      service.login({ email: 'maria@email.com', password: 'senhaSegura1' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
