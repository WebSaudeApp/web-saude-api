import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  it('retorna ok quando o banco está conectado', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('lança 503 quando o banco está indisponível', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(false),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('retorna api online na raiz', () => {
    const prisma = {
      isDatabaseConnected: jest.fn(),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);

    expect(controller.root()).toEqual({ message: 'api online' });
  });
});
