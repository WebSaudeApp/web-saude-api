import { ConflictException, NotFoundException } from '@nestjs/common';
import { EspecialidadesService } from './especialidades.service';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

describe('EspecialidadesService', () => {
  let service: EspecialidadesService;
  let prismaMock: {
    especialidade: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    estabelecimentoEspecialidade: {
      count: jest.Mock;
    };
  };

  const especialidadeExemplo = {
    id: 'esp-1',
    nome: 'Cardiologia',
  };

  beforeEach(() => {
    prismaMock = {
      especialidade: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      estabelecimentoEspecialidade: {
        count: jest.fn(),
      },
    };

    service = new EspecialidadesService(prismaMock as unknown as PrismaService);
  });

  it('lista especialidades ordenadas por nome asc', async () => {
    prismaMock.especialidade.findMany.mockResolvedValue([especialidadeExemplo]);

    const resultado = await service.list();

    expect(resultado).toEqual([especialidadeExemplo]);
    expect(prismaMock.especialidade.findMany).toHaveBeenCalledWith({
      orderBy: { nome: 'asc' },
    });
  });

  it('detalha especialidade existente pelo id', async () => {
    prismaMock.especialidade.findUnique.mockResolvedValue(especialidadeExemplo);

    const resultado = await service.findOne('esp-1');

    expect(resultado).toEqual(especialidadeExemplo);
    expect(prismaMock.especialidade.findUnique).toHaveBeenCalledWith({
      where: { id: 'esp-1' },
    });
  });

  it('lança 404 ao buscar especialidade inexistente', async () => {
    prismaMock.especialidade.findUnique.mockResolvedValue(null);

    await expect(service.findOne('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('cadastra uma nova especialidade com sucesso', async () => {
    prismaMock.especialidade.create.mockResolvedValue(especialidadeExemplo);

    const resultado = await service.create({ nome: '  Cardiologia  ' });

    expect(resultado).toEqual(especialidadeExemplo);
    expect(prismaMock.especialidade.create).toHaveBeenCalledWith({
      data: { nome: 'Cardiologia' },
    });
  });

  it('lança 409 ao tentar cadastrar especialidade com nome duplicado', async () => {
    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.0.0',
      },
    );
    prismaMock.especialidade.create.mockRejectedValue(p2002Error);

    await expect(service.create({ nome: 'Cardiologia' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('atualiza nome da especialidade', async () => {
    prismaMock.especialidade.findUnique.mockResolvedValue(especialidadeExemplo);
    prismaMock.especialidade.update.mockResolvedValue({
      id: 'esp-1',
      nome: 'Cardiologia Geral',
    });

    const resultado = await service.update('esp-1', {
      nome: 'Cardiologia Geral',
    });

    expect(resultado.nome).toBe('Cardiologia Geral');
    expect(prismaMock.especialidade.update).toHaveBeenCalledWith({
      where: { id: 'esp-1' },
      data: { nome: 'Cardiologia Geral' },
    });
  });

  it('remove especialidade quando não possui vínculos', async () => {
    prismaMock.especialidade.findUnique.mockResolvedValue(especialidadeExemplo);
    prismaMock.estabelecimentoEspecialidade.count.mockResolvedValue(0);
    prismaMock.especialidade.delete.mockResolvedValue(especialidadeExemplo);

    const resultado = await service.remove('esp-1');

    expect(resultado).toEqual(especialidadeExemplo);
    expect(prismaMock.especialidade.delete).toHaveBeenCalledWith({
      where: { id: 'esp-1' },
    });
  });

  it('impede remoção e lança 409 quando especialidade possui estabelecimentos vinculados', async () => {
    prismaMock.especialidade.findUnique.mockResolvedValue(especialidadeExemplo);
    prismaMock.estabelecimentoEspecialidade.count.mockResolvedValue(3);

    await expect(service.remove('esp-1')).rejects.toThrow(ConflictException);
    expect(prismaMock.especialidade.delete).not.toHaveBeenCalled();
  });
});
