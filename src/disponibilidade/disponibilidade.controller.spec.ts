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

    await expect(controller.verificar()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
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

    await expect(controller.verificar()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('retorna mensagem api online na rota raiz', () => {
    const prisma = {
      isDatabaseConnected: jest.fn(),
    };
    const busca = {
      estaDisponivel: jest.fn(),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    expect(controller.raiz()).toEqual({ mensagem: 'api online' });
  });
});
