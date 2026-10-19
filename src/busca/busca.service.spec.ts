import { BadRequestException } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { BuscaService } from './busca.service';
import {
  ALIAS_ESTABELECIMENTOS,
  CONFIGURACAO_INDICE_ESTABELECIMENTOS,
  INDICE_ESTABELECIMENTOS_PADRAO,
} from './constantes';
import { DocumentoEstabelecimento } from './documento-estabelecimento';

describe('BuscaService', () => {
  const documentoValido: DocumentoEstabelecimento = {
    id: 'est-1',
    nome: 'Hospital Esperança',
    tipo: { id: 'tipo-1', nome: 'HOSPITAL' },
    endereco: {
      cep: '50070-000',
      logradouro: 'Rua do Espinheiro',
      numero: '100',
      bairro: 'Espinheiro',
      cidade: 'Recife',
      estado: 'PE',
    },
    localizacao: {
      lat: -8.0476,
      lon: -34.877,
    },
    especialidades: [{ id: 'esp-1', nome: 'Cardiologia' }],
    horarios: [
      {
        diaSemana: 'SEGUNDA',
        horaAbertura: '08:00',
        horaFechamento: '18:00',
        atende24h: false,
      },
    ],
    notaMedia: 4.8,
    totalReviews: 25,
  };

  it('retorna true quando o ping do Elasticsearch responder com sucesso', async () => {
    const elasticsearchMock = {
      ping: jest.fn().mockResolvedValue(true),
    };

    const service = new BuscaService(
      elasticsearchMock as unknown as ElasticsearchService,
    );

    const disponivel = await service.estaDisponivel();
    expect(disponivel).toBe(true);
    expect(elasticsearchMock.ping).toHaveBeenCalled();
  });

  it('retorna false quando o ping do Elasticsearch falhar', async () => {
    const elasticsearchMock = {
      ping: jest.fn().mockRejectedValue(new Error('Connection refused')),
    };

    const service = new BuscaService(
      elasticsearchMock as unknown as ElasticsearchService,
    );

    const disponivel = await service.estaDisponivel();
    expect(disponivel).toBe(false);
    expect(elasticsearchMock.ping).toHaveBeenCalled();
  });

  it('fornece acesso ao cliente do Elasticsearch', () => {
    const elasticsearchMock = {
      ping: jest.fn(),
    };

    const service = new BuscaService(
      elasticsearchMock as unknown as ElasticsearchService,
    );

    expect(service.obterCliente()).toBe(elasticsearchMock);
  });

  describe('inicializarIndice', () => {
    it('cria o índice e o alias quando nenhum dos dois existe', async () => {
      const indicesMock = {
        exists: jest.fn().mockResolvedValue(false),
        existsAlias: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue({ acknowledged: true }),
        putAlias: jest.fn().mockResolvedValue({ acknowledged: true }),
      };

      const elasticsearchMock = {
        indices: indicesMock,
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const resultado = await service.inicializarIndice();

      expect(resultado).toEqual({ criado: true, aliasCriado: true });
      expect(indicesMock.exists).toHaveBeenCalledWith({
        index: INDICE_ESTABELECIMENTOS_PADRAO,
      });
      expect(indicesMock.create).toHaveBeenCalledWith({
        index: INDICE_ESTABELECIMENTOS_PADRAO,
        ...CONFIGURACAO_INDICE_ESTABELECIMENTOS,
      });
      expect(indicesMock.existsAlias).toHaveBeenCalledWith({
        name: ALIAS_ESTABELECIMENTOS,
      });
      expect(indicesMock.putAlias).toHaveBeenCalledWith({
        index: INDICE_ESTABELECIMENTOS_PADRAO,
        name: ALIAS_ESTABELECIMENTOS,
      });
    });

    it('não recria o índice nem o alias quando ambos já existem', async () => {
      const indicesMock = {
        exists: jest.fn().mockResolvedValue(true),
        existsAlias: jest.fn().mockResolvedValue(true),
        create: jest.fn(),
        putAlias: jest.fn(),
      };

      const elasticsearchMock = {
        indices: indicesMock,
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const resultado = await service.inicializarIndice();

      expect(resultado).toEqual({ criado: false, aliasCriado: false });
      expect(indicesMock.create).not.toHaveBeenCalled();
      expect(indicesMock.putAlias).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('inicializa o índice automaticamente se o Elasticsearch estiver disponível', async () => {
      const elasticsearchMock = {
        ping: jest.fn().mockResolvedValue(true),
        indices: {
          exists: jest.fn().mockResolvedValue(true),
          existsAlias: jest.fn().mockResolvedValue(true),
          create: jest.fn(),
          putAlias: jest.fn(),
        },
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const spy = jest.spyOn(service, 'inicializarIndice');
      await service.onModuleInit();

      expect(spy).toHaveBeenCalled();
    });

    it('não quebra a aplicação se o ping falhar na inicialização', async () => {
      const elasticsearchMock = {
        ping: jest.fn().mockRejectedValue(new Error('Offline')),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const spy = jest.spyOn(service, 'inicializarIndice');
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('indexarEstabelecimento (geo_point)', () => {
    it('indexa com sucesso documento contendo coordenadas válidas', async () => {
      const elasticsearchMock = {
        index: jest.fn().mockResolvedValue({ result: 'created' }),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      await expect(
        service.indexarEstabelecimento(documentoValido),
      ).resolves.toBeUndefined();

      expect(elasticsearchMock.index).toHaveBeenCalledWith({
        index: ALIAS_ESTABELECIMENTOS,
        id: documentoValido.id,
        document: documentoValido,
      });
    });

    it('recusa indexação e lança BadRequestException quando latitude for inválida (> 90)', async () => {
      const elasticsearchMock = {
        index: jest.fn(),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const docInvalido = {
        ...documentoValido,
        localizacao: { lat: 95.5, lon: -34.877 },
      };

      await expect(
        service.indexarEstabelecimento(docInvalido),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(elasticsearchMock.index).not.toHaveBeenCalled();
    });

    it('recusa indexação quando longitude for inválida (< -180)', async () => {
      const elasticsearchMock = {
        index: jest.fn(),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const docInvalido = {
        ...documentoValido,
        localizacao: { lat: -8.05, lon: -185 },
      };

      await expect(
        service.indexarEstabelecimento(docInvalido),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(elasticsearchMock.index).not.toHaveBeenCalled();
    });

    it('recusa indexação quando coordenadas forem ausentes ou não numéricas', async () => {
      const elasticsearchMock = {
        index: jest.fn(),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const docInvalido = {
        ...documentoValido,
        localizacao: { lat: NaN, lon: -34.877 },
      };

      await expect(
        service.indexarEstabelecimento(docInvalido),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(elasticsearchMock.index).not.toHaveBeenCalled();
    });
  });

  describe('obterEstabelecimentoPorId e removerEstabelecimento', () => {
    it('retorna documento quando encontrado por id', async () => {
      const elasticsearchMock = {
        get: jest.fn().mockResolvedValue({ _source: documentoValido }),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const doc = await service.obterEstabelecimentoPorId('est-1');
      expect(doc).toEqual(documentoValido);
    });

    it('retorna null quando get retornar status 404', async () => {
      const erro404 = { statusCode: 404 };
      const elasticsearchMock = {
        get: jest.fn().mockRejectedValue(erro404),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      const doc = await service.obterEstabelecimentoPorId('inexistente');
      expect(doc).toBeNull();
    });

    it('remove estabelecimento com sucesso', async () => {
      const elasticsearchMock = {
        delete: jest.fn().mockResolvedValue({ result: 'deleted' }),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      await expect(
        service.removerEstabelecimento('est-1'),
      ).resolves.toBeUndefined();
      expect(elasticsearchMock.delete).toHaveBeenCalledWith({
        index: ALIAS_ESTABELECIMENTOS,
        id: 'est-1',
      });
    });

    it('ignora erro 404 ao tentar remover estabelecimento inexistente', async () => {
      const erro404 = { statusCode: 404 };
      const elasticsearchMock = {
        delete: jest.fn().mockRejectedValue(erro404),
      };

      const service = new BuscaService(
        elasticsearchMock as unknown as ElasticsearchService,
      );

      await expect(
        service.removerEstabelecimento('inexistente'),
      ).resolves.toBeUndefined();
    });
  });
});
