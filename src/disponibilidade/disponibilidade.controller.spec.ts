import { ServiceUnavailableException } from '@nestjs/common';
import { DisponibilidadeController } from './disponibilidade.controller';
import { PrismaService } from '../database/prisma.service';
import { BuscaService } from '../busca/busca.service';

describe('DisponibilidadeController', () => {
  it('retorna ok quando o banco e o elasticsearch estão conectados', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(true),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    await expect(controller.verificar()).resolves.toEqual({
      status: 'ok',
      banco: 'conectado',
      elasticsearch: 'conectado',
    });
  });

  it('lança 503 quando o banco está desconectado', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(false),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(true),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    const promessa = controller.verificar();
    await expect(promessa).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promessa).rejects.toMatchObject({
      response: {
        status: 'erro',
        banco: 'desconectado',
        elasticsearch: 'conectado',
      },
    });
  });

  it('lança 503 quando o elasticsearch está indisponível', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(false),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    const promessa = controller.verificar();
    await expect(promessa).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promessa).rejects.toMatchObject({
      response: {
        status: 'erro',
        banco: 'conectado',
        elasticsearch: 'desconectado',
      },
    });
  });

  it('retorna mensagem api online na rota raiz', () => {
    const prisma = {} as PrismaService;
    const busca = {} as BuscaService;
    const controller = new DisponibilidadeController(prisma, busca);

    expect(controller.raiz()).toEqual({ mensagem: 'api online' });
  });
});
