import { Test, TestingModule } from '@nestjs/testing';
import { PapelUsuario, StatusUsuario } from '@prisma/client';
import type { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    loginComGoogle: jest.Mock;
  };

  const mockResponse = {
    accessToken: 'jwt-access-token',
    refreshToken: 'refresh-token-hash',
    expiresIn: 900,
    usuario: {
      id: 'uuid-1',
      nome: 'Maria Silva',
      email: 'maria@email.com',
      telefone: '81999998888',
      papel: PapelUsuario.PACIENTE,
      status: StatusUsuario.ATIVO,
      criadoEm: new Date(),
    },
  };

  const mockReq = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'Jest-Test' },
  } as unknown as Request;

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(mockResponse),
      login: jest.fn().mockResolvedValue(mockResponse),
      loginComGoogle: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('deve chamar o authService.register com DTO e metadados', async () => {
    const dto = {
      nome: 'Maria Silva',
      email: 'maria@email.com',
      senha: 'senhaSegura123',
      papel: PapelUsuario.PACIENTE,
    };

    const res = await controller.register(dto, mockReq);
    expect(authService.register).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ ip: '127.0.0.1', userAgent: 'Jest-Test' }),
    );
    expect(res).toEqual(mockResponse);
  });

  it('deve chamar o authService.login com DTO e metadados', async () => {
    const dto = {
      email: 'maria@email.com',
      senha: 'senhaSegura123',
    };

    const res = await controller.login(dto, mockReq);
    expect(authService.login).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ ip: '127.0.0.1', userAgent: 'Jest-Test' }),
    );
    expect(res).toEqual(mockResponse);
  });

  it('deve chamar o authService.loginComGoogle com DTO e metadados', async () => {
    const dto = {
      idToken: 'google-mock-id-token',
    };

    const res = await controller.loginComGoogle(dto, mockReq);
    expect(authService.loginComGoogle).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ ip: '127.0.0.1', userAgent: 'Jest-Test' }),
    );
    expect(res).toEqual(mockResponse);
  });
});
