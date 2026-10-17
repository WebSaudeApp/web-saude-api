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

  it('devolve o resultado com a paginação padrão e os campos dos models (RN07, RN08, RN11)', async () => {
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

  it('combina os filtros, normaliza o texto e compara o tipo como CLINICA (RN05, RN08)', async () => {
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

  it('devolve lista vazia e zero páginas quando nenhum estabelecimento atende ao filtro (E1)', async () => {
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

  it('devolve lista vazia mantendo o total real quando a página passa da última (E5)', async () => {
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

  it('filtra a especialidade pelo id quando ele é enviado (A2, RN06)', async () => {
    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      especialidade: 'especialidade-uuid-1',
    });

    await service.search(query);

    expect(queryRaw).toHaveBeenCalled();
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toContain('especialidade-uuid-1');
  });

  it('lança erro interno quando a consulta ao banco falha (E6)', async () => {
    findMany.mockRejectedValue(new Error('Banco de dados fora do ar'));

    await expect(
      service.search(new BuscarEstabelecimentosDto()),
    ).rejects.toThrow('Banco de dados fora do ar');
  });

  it('devolve o estabelecimento completo quando o id existe (passo 11, RN11, RN12)', async () => {
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

  it('lança 404 quando o id do estabelecimento não existe (E8)', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findOne('nao-existe')).rejects.toThrow(
      new NotFoundException('Estabelecimento não encontrado.'),
    );
  });

  it('devolve lista vazia, sem erro, quando o tipo não existe, como LABORATORIO (RN05, E1, CA07)', async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      tipo: 'LABORATORIO',
    });

    const result = await service.search(query);

    expect(result).toEqual({
      dados: [],
      paginacao: {
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
      },
    });
  });

  it('devolve lista vazia quando a especialidade não corresponde a nenhum registro (RN06, E1)', async () => {
    queryRaw.mockResolvedValue([]);
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      especialidade: 'Especialidade Inexistente',
    });

    const result = await service.search(query);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      dados: [],
      paginacao: {
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
      },
    });
  });

  it('busca por parte do termo ou pelo bairro ignorando maiúsculas e acentos (RN02, RN03, CA02, CA10)', async () => {
    queryRaw.mockResolvedValue([{ id: estabelecimento.id }]);
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([estabelecimento]);

    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      termo: 'Boa Viagem',
      cidade: 'São Paulo',
    });

    const result = await service.search(query);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual(
      expect.arrayContaining(['boa viagem', 'sao paulo']),
    );
    expect(result.dados).toHaveLength(1);
  });

  it('calcula a paginação na última página parcial com 23 itens (RN08, A3, A4, CA06)', async () => {
    count.mockResolvedValue(23);
    findMany.mockResolvedValue([
      estabelecimento,
      { ...estabelecimento, id: 'estabelecimento-2' },
      { ...estabelecimento, id: 'estabelecimento-3' },
    ]);

    const query = Object.assign(new BuscarEstabelecimentosDto(), {
      pagina: 3,
      limite: 10,
    });

    const result = await service.search(query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
    expect(result.dados).toHaveLength(3);
    expect(result.paginacao).toEqual({
      pagina: 3,
      limite: 10,
      total: 23,
      totalPaginas: 3,
    });
  });
});
