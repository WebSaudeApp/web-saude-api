import { ElasticsearchService } from '@nestjs/elasticsearch';
import { BuscaService } from './busca.service';

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
});
