import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EspecialidadesService } from '../especialidades/especialidades.service';
import { BuscarEstabelecimentosDto } from './dto/buscar-estabelecimentos.dto';
import { EstabelecimentosService } from './estabelecimentos.service';

describe('EstabelecimentosService', () => {
  const count = jest.fn<(args: unknown) => Promise<number>>(() =>
    Promise.resolve(0),
  );
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>(() =>
    Promise.resolve([]),
  );
  const findUnique = jest.fn<(args: unknown) => Promise<unknown>>(() =>
    Promise.resolve(null),
  );
  const groupBy = jest.fn<(args: unknown) => Promise<unknown[]>>(() =>
    Promise.resolve([]),
  );
  const queryRaw = jest.fn<
    (query: Prisma.Sql) => Promise<Array<{ id: string }>>
  >(() => Promise.resolve([]));
  const prisma = {
    estabelecimento: { count, findMany, findUnique },
    review: { groupBy },
    $queryRaw: queryRaw,
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  } as unknown as PrismaService;
  const service = new EstabelecimentosService(
    prisma,
    {} as EspecialidadesService,
  );

  const estabelecimento = {
    id: 'estabelecimento-1',
    nome: 'Hospital São João',
    tipo: { id: 'tipo-1', nome: 'HOSPITAL' },
    endereco: {
      id: 'endereco-1',
      cep: '50000000',
      logradouro: 'Rua das Flores',
      numero: '100',
      complemento: null,
      bairro: 'São João',
      cidade: 'Recife',
      estado: 'PE',
      latitude: -8.05,
      longitude: -34.9,
    },
    contatos: [{ id: 'contato-1', tipo: 'TELEFONE', valor: '8133334444' }],
    especialidades: [
      {
        especialidade: { id: 'especialidade-1', nome: 'Cardiologia' },
      },
    ],
    horarios: [],
    midias: [{ id: 'midia-1', tipo: 'FOTO', url: '/foto.jpg', legenda: null }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
    findUnique.mockResolvedValue(null);
    groupBy.mockResolvedValue([]);
  });

  it('returns the search results with default pagination and mapped model fields', async () => {
    count.mockResolvedValue(21);
    findMany.mockResolvedValue([estabelecimento]);

    const result = await service.search(new BuscarEstabelecimentosDto());

    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(result.dados).toHaveLength(1);
    expect(result.dados[0]).toMatchObject({
      id: estabelecimento.id,
      nome: estabelecimento.nome,
      endereco: {
        latitude: -8.05,
        longitude: -34.9,
      },
      especialidades: [{ id: 'especialidade-1', nome: 'Cardiologia' }],
      midias: estabelecimento.midias,
    });
    expect(result.paginacao).toEqual({
      pagina: 1,
      limite: 20,
      total: 21,
      totalPaginas: 2,
    });
    expect(result.dados[0]).not.toHaveProperty('notaMedia');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('combines filters, normalizes text and matches CLINICA type (RN05, RN08)', async () => {
    queryRaw.mockResolvedValue([{ id: estabelecimento.id }]);
    findMany.mockResolvedValue([estabelecimento]);
    count.mockResolvedValue(1);

    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      termo: 'São João',
      tipo: 'clinica',
      especialidade: 'Cardiologia',
      cidade: 'Recife',
      estado: 'pe',
      pagina: 1,
      limite: 5,
    });
    const result = await service.search(query);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual(
      expect.arrayContaining([
        'sao joao',
        'recife',
        'Cardiologia',
        'cardiologia',
      ]),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        tipo: { nome: { equals: 'CLINICA', mode: 'insensitive' } },
        id: { in: [estabelecimento.id] },
        endereco: { estado: { equals: 'pe', mode: 'insensitive' } },
      },
    });
    expect(result.paginacao).toEqual({
      pagina: 1,
      limite: 5,
      total: 1,
      totalPaginas: 1,
    });
  });

  it('returns empty results with zero pages when no establishments match (E1)', async () => {
    const result = await service.search(
      Object.assign(new BuscarEstabelecimentosDto(), { pagina: 3, limite: 10 }),
    );

    expect(result).toEqual({
      dados: [],
      paginacao: {
        pagina: 3,
        limite: 10,
        total: 0,
        totalPaginas: 0,
      },
    });
  });

  it('returns empty list preserving real total when page is beyond last page (E5)', async () => {
    count.mockResolvedValue(15);
    findMany.mockResolvedValue([]);

    const result = await service.search(
      Object.assign(new BuscarEstabelecimentosDto(), { pagina: 3, limite: 10 }),
    );

    expect(result.dados).toEqual([]);
    expect(result.paginacao).toEqual({
      pagina: 3,
      limite: 10,
      total: 15,
      totalPaginas: 2,
    });
  });

  it('filters specialty by ID when an id format is provided (A2, RN06)', async () => {
    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      especialidade: 'especialidade-uuid-1',
    });

    await service.search(query);

    expect(queryRaw).toHaveBeenCalled();
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toContain('especialidade-uuid-1');
  });

  it('throws internal error when database transaction fails (E6)', async () => {
    findMany.mockRejectedValue(new Error('Database offline'));

    await expect(
      service.search(new BuscarEstabelecimentosDto()),
    ).rejects.toThrow('Database offline');
  });

  it('returns the full establishment when the id exists (step 11, RN11, RN12)', async () => {
    const horario = {
      id: 'horario-1',
      diaSemana: 'SEGUNDA',
      horaAbertura: new Date('1970-01-01T08:00:00.000Z'),
      horaFechamento: new Date('1970-01-01T18:00:00.000Z'),
      atende24h: false,
    };
    findUnique.mockResolvedValue({ ...estabelecimento, horarios: [horario] });

    const result = await service.findOne(estabelecimento.id);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: estabelecimento.id } }),
    );
    expect(result).toMatchObject({
      id: estabelecimento.id,
      nome: estabelecimento.nome,
      endereco: {
        cidade: 'Recife',
        latitude: -8.05,
        longitude: -34.9,
      },
      especialidades: [{ id: 'especialidade-1', nome: 'Cardiologia' }],
      midias: estabelecimento.midias,
      horarios: [
        {
          id: 'horario-1',
          diaSemana: 'SEGUNDA',
          horaAbertura: '08:00',
          horaFechamento: '18:00',
          atende24h: false,
        },
      ],
    });
  });

  it('throws 404 when the establishment id does not exist (E8)', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findOne('nao-existe')).rejects.toThrow(
      new NotFoundException('Estabelecimento não encontrado.'),
    );
  });
});
