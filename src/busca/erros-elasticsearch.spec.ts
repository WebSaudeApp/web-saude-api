import { errors } from '@elastic/elasticsearch';
import { elasticsearchIndisponivel } from './erros-elasticsearch';

const resposta = (statusCode: number, tipo?: string) =>
  new errors.ResponseError({
    statusCode,
    body: tipo ? { error: { type: tipo } } : {},
    headers: {},
    meta: {} as never,
    warnings: null,
  });

describe('elasticsearchIndisponivel', () => {
  it('trata falhas de conexão, timeout e ausência de nó vivo como indisponibilidade', () => {
    expect(
      elasticsearchIndisponivel(new errors.ConnectionError('x', {} as never)),
    ).toBe(true);
    expect(
      elasticsearchIndisponivel(new errors.TimeoutError('x', {} as never)),
    ).toBe(true);
    expect(
      elasticsearchIndisponivel(
        new errors.NoLivingConnectionsError('x', {} as never),
      ),
    ).toBe(true);
  });

  it('trata HTTP 5xx, 429 e índice inexistente (antes do es:init) como indisponibilidade', () => {
    expect(elasticsearchIndisponivel(resposta(503))).toBe(true);
    expect(
      elasticsearchIndisponivel(resposta(429, 'circuit_breaking_exception')),
    ).toBe(true);
    expect(
      elasticsearchIndisponivel(resposta(404, 'index_not_found_exception')),
    ).toBe(true);
  });

  it('trata códigos de rede do Node como indisponibilidade', () => {
    expect(
      elasticsearchIndisponivel(
        Object.assign(new Error('x'), { code: 'ECONNREFUSED' }),
      ),
    ).toBe(true);
  });

  it('NÃO trata 400 (bug de query), 404 de outro tipo nem erros nossos como indisponibilidade', () => {
    expect(elasticsearchIndisponivel(resposta(400, 'parsing_exception'))).toBe(
      false,
    );
    expect(
      elasticsearchIndisponivel(resposta(404, 'resource_not_found_exception')),
    ).toBe(false);
    expect(elasticsearchIndisponivel(new TypeError('bug nosso'))).toBe(false);
    expect(elasticsearchIndisponivel('texto')).toBe(false);
    expect(elasticsearchIndisponivel(null)).toBe(false);
  });
});
