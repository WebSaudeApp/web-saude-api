import { beforeEach, describe, expect, it, jest } from '@jest/globals';
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
  const queryRaw = jest.fn<
    (query: Prisma.Sql) => Promise<Array<{ id: string }>>
  >(() => Promise.resolve([]));
  const prisma = {
    estabelecimento: { count, findMany },
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

  it('combines filters, normalizes text and maps CLINICA to the Prisma value', async () => {
    queryRaw.mockResolvedValue([{ id: estabelecimento.id }]);
    findMany.mockResolvedValue([estabelecimento]);

    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      termo: 'São João',
      tipo: 'clinica',
      especialidade: 'Cardiologia',
      cidade: 'Recife',
      estado: 'pe',
      pagina: 2,
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
        tipo: { nome: { equals: 'CLINIC', mode: 'insensitive' } },
        id: { in: [estabelecimento.id] },
        endereco: { estado: { equals: 'pe', mode: 'insensitive' } },
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.paginacao).toEqual({
      pagina: 2,
      limite: 5,
      total: 0,
      totalPaginas: 0,
    });
  });

  it('returns empty results with zero pages when no establishments match', async () => {
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
});
