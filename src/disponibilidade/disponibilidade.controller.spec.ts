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
      situacaoIndice: jest.fn().mockResolvedValue('disponivel'),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    await expect(controller.verificar()).resolves.toEqual({
      status: 'ok',
      banco: 'conectado',
      elasticsearch: 'conectado',
      indiceBusca: 'disponivel',
    });
  });

  it('lança 503 quando o banco está desconectado', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(false),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(true),
      situacaoIndice: jest.fn().mockResolvedValue('disponivel'),
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

  it('responde 200 degradado quando só o elasticsearch está indisponível', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(false),
      situacaoIndice: jest.fn().mockResolvedValue('ausente'),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    await expect(controller.verificar()).resolves.toEqual({
      status: 'degradado',
      banco: 'conectado',
      elasticsearch: 'desconectado',
      indiceBusca: 'desconhecido',
    });
  });

  it('responde 200 degradado quando o ES está no ar mas o índice não existe (antes do es:init)', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(true),
      situacaoIndice: jest.fn().mockResolvedValue('ausente'),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    await expect(controller.verificar()).resolves.toEqual({
      status: 'degradado',
      banco: 'conectado',
      elasticsearch: 'conectado',
      indiceBusca: 'ausente',
    });
  });

  it('mantém status ok quando a checagem do índice é inconclusiva (403/timeout = desconhecido)', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(true),
      situacaoIndice: jest.fn().mockResolvedValue('desconhecido'),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    await expect(controller.verificar()).resolves.toEqual({
      status: 'ok',
      banco: 'conectado',
      elasticsearch: 'conectado',
      indiceBusca: 'desconhecido',
    });
  });

  it('passa um prazo curto às checagens do ES (não usa o timeout padrão do cliente)', async () => {
    const prisma = {
      isDatabaseConnected: jest.fn().mockResolvedValue(true),
    };
    const busca = {
      estaDisponivel: jest.fn().mockResolvedValue(true),
      situacaoIndice: jest.fn().mockResolvedValue('disponivel'),
    };
    const controller = new DisponibilidadeController(
      prisma as unknown as PrismaService,
      busca as unknown as BuscaService,
    );

    await controller.verificar();

    const [prazoPing] = busca.estaDisponivel.mock.calls[0] as [number];
    const [prazoIndice] = busca.situacaoIndice.mock.calls[0] as [number];
    expect(prazoPing).toBeGreaterThan(0);
    expect(prazoPing).toBeLessThanOrEqual(2000);
    expect(prazoIndice).toBe(prazoPing);
  });

  it('retorna mensagem api online na rota raiz', () => {
    const prisma = {} as PrismaService;
    const busca = {} as BuscaService;
    const controller = new DisponibilidadeController(prisma, busca);

    expect(controller.raiz()).toEqual({ mensagem: 'api online' });
  });
});
