import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EspecialidadesService } from '../especialidades/especialidades.service';
import { BuscaService } from '../busca/busca.service';
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
  const indexarEstabelecimento = jest.fn<(args: unknown) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const removerEstabelecimento = jest.fn<(args: unknown) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const obterCliente = jest.fn(() => ({
    indices: {
      refresh: jest.fn<() => Promise<void>>(() => Promise.resolve()),
    },
  }));
  const buscarEstabelecimentos = jest.fn();
  const buscaService = {
    indexarEstabelecimento,
    removerEstabelecimento,
    buscarEstabelecimentos,
    obterCliente,
  } as unknown as BuscaService;
  const service = new EstabelecimentosService(
    prisma,
    {} as EspecialidadesService,
    buscaService,
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

  describe('Sincronização com o Elasticsearch (BE-15)', () => {
    it('sincroniza o estabelecimento com o Elasticsearch com sucesso', async () => {
      findUnique.mockResolvedValue(estabelecimento);

      await service.sincronizarComElasticsearch(estabelecimento.id);

      expect(indexarEstabelecimento).toHaveBeenCalledWith(
        expect.objectContaining({
          id: estabelecimento.id,
          nome: estabelecimento.nome,
          localizacao: {
            lat: estabelecimento.endereco.latitude,
            lon: estabelecimento.endereco.longitude,
          },
        }),
      );
    });

    it('não lança erro quando a indexação no Elasticsearch falha (resiliência / tolerância a falhas)', async () => {
      findUnique.mockResolvedValue(estabelecimento);
      indexarEstabelecimento.mockRejectedValue(
        new Error('Elasticsearch fora do ar'),
      );

      await expect(
        service.sincronizarComElasticsearch(estabelecimento.id),
      ).resolves.toBeUndefined();
    });

    it('remove o estabelecimento do Elasticsearch com sucesso', async () => {
      await service.removerDoElasticsearch(estabelecimento.id);

      expect(removerEstabelecimento).toHaveBeenCalledWith(estabelecimento.id);
    });

    it('não lança erro quando a remoção no Elasticsearch falha', async () => {
      removerEstabelecimento.mockRejectedValue(
        new Error('Elasticsearch fora do ar'),
      );

      await expect(
        service.removerDoElasticsearch(estabelecimento.id),
      ).resolves.toBeUndefined();
    });

    it('reindexa todos os estabelecimentos do banco com sucesso (BE-16)', async () => {
      findMany.mockResolvedValue([
        { id: 'estabelecimento-1' },
        { id: 'estabelecimento-2' },
      ]);
      findUnique.mockResolvedValue(estabelecimento);
      indexarEstabelecimento.mockResolvedValue(undefined);

      const resultado = await service.reindexarTodos();

      expect(resultado).toEqual({
        total: 2,
        indexados: 2,
        erros: 0,
        falhas: [],
      });
      expect(indexarEstabelecimento).toHaveBeenCalledTimes(2);
    });

    it('registra falha individual e continua reindexando os demais estabelecimentos', async () => {
      findMany.mockResolvedValue([
        { id: 'estabelecimento-1' },
        { id: 'estabelecimento-2' },
      ]);
      findUnique
        .mockResolvedValueOnce(estabelecimento)
        .mockRejectedValueOnce(new Error('Erro no estabelecimento 2'));

      const resultado = await service.reindexarTodos();

      expect(resultado.total).toBe(2);
      expect(resultado.indexados).toBe(1);
      expect(resultado.erros).toBe(1);
      expect(resultado.falhas).toHaveLength(1);
      expect(resultado.falhas[0].id).toBe('estabelecimento-2');
    });
  });

  describe('search por proximidade geográfica (BE-09)', () => {
    const estabelecimento2 = {
      ...estabelecimento,
      id: 'estabelecimento-2',
      nome: 'Clínica Boa Vista',
    };

    beforeEach(() => {
      buscarEstabelecimentos.mockReset();
      findMany.mockReset();
    });

    it('busca por proximidade geográfica retornando lista ordenada com distanciaKm arredondada', async () => {
      buscarEstabelecimentos.mockResolvedValue({
        itens: [
          {
            estabelecimento: { id: 'estabelecimento-1' },
            distanciaKm: 1.234,
          },
          {
            estabelecimento: { id: 'estabelecimento-2' },
            distanciaKm: 5.678,
          },
        ],
        total: 2,
        pagina: 1,
        totalPaginas: 1,
      });

      findMany.mockResolvedValue([estabelecimento2, estabelecimento]);

      const resultado = await service.search({
        lat: -8.05389,
        lng: -34.88111,
        raioKm: 10,
      } as BuscarEstabelecimentosDto);

      expect(buscarEstabelecimentos).toHaveBeenCalledWith(
        expect.objectContaining({
          localizacao: {
            lat: -8.05389,
            lon: -34.88111,
            raioKm: 10,
          },
        }),
      );

      // Confere ordem exata do Elasticsearch e distanciaKm com 1 casa decimal
      expect(resultado.dados).toHaveLength(2);
      expect(resultado.dados[0].id).toBe('estabelecimento-1');
      expect(
        (resultado.dados[0] as unknown as { distanciaKm: number }).distanciaKm,
      ).toBe(1.2);
      expect(resultado.dados[1].id).toBe('estabelecimento-2');
      expect(
        (resultado.dados[1] as unknown as { distanciaKm: number }).distanciaKm,
      ).toBe(5.7);
      expect(resultado.paginacao.total).toBe(2);
    });

    it('retorna lista vazia quando nenhum estabelecimento está no raio', async () => {
      buscarEstabelecimentos.mockResolvedValue({
        itens: [],
        total: 0,
        pagina: 1,
        totalPaginas: 0,
      });

      const resultado = await service.search({
        lat: -8.05,
        lng: -34.88,
      } as BuscarEstabelecimentosDto);

      expect(resultado.dados).toEqual([]);
      expect(resultado.paginacao.total).toBe(0);
      expect(resultado.paginacao.totalPaginas).toBe(0);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('rejeita lat sem lng com erro 400', async () => {
      await expect(
        service.search({ lat: -8.05 } as BuscarEstabelecimentosDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita lng sem lat com erro 400', async () => {
      await expect(
        service.search({ lng: -34.88 } as BuscarEstabelecimentosDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita raioKm sem coordenadas com erro 400', async () => {
      await expect(
        service.search({ raioKm: 15 } as BuscarEstabelecimentosDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança erro 503 quando o Elasticsearch falha na busca geográfica', async () => {
      buscarEstabelecimentos.mockRejectedValue(
        new Error('Elasticsearch indisponível'),
      );

      await expect(
        service.search({
          lat: -8.05,
          lng: -34.88,
        } as BuscarEstabelecimentosDto),
      ).rejects.toThrow(
        'Serviço de busca por localização temporariamente indisponível.',
      );
    });
  });
});
