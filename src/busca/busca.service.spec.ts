import { ElasticsearchService } from '@nestjs/elasticsearch';
import { BuscaService } from './busca.service';
import {
  ALIAS_ESTABELECIMENTOS,
  CONFIGURACAO_INDICE_ESTABELECIMENTOS,
  INDICE_ESTABELECIMENTOS_PADRAO,
} from './constantes';

describe('BuscaService', () => {
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
});
