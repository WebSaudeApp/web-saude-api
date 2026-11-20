import { elasticsearchIndisponivel } from './erros-elasticsearch';

const erroComNome = (name: string) => Object.assign(new Error('x'), { name });

describe('elasticsearchIndisponivel', () => {
  it.each(['ConnectionError', 'TimeoutError', 'NoLivingConnectionsError'])(
    'trata %s como indisponibilidade',
    (nome) => {
      expect(elasticsearchIndisponivel(erroComNome(nome))).toBe(true);
    },
  );

  it('trata códigos de rede e HTTP 5xx como indisponibilidade', () => {
    expect(
      elasticsearchIndisponivel(
        Object.assign(new Error('x'), { code: 'ECONNREFUSED' }),
      ),
    ).toBe(true);
    expect(
      elasticsearchIndisponivel(
        Object.assign(new Error('x'), {
          name: 'ResponseError',
          meta: { statusCode: 503 },
        }),
      ),
    ).toBe(true);
  });

  it('NÃO trata 4xx (bug de query) nem erros nossos como indisponibilidade', () => {
    expect(
      elasticsearchIndisponivel(
        Object.assign(new Error('parsing_exception'), {
          name: 'ResponseError',
          meta: { statusCode: 400 },
        }),
      ),
    ).toBe(false);
    expect(
      elasticsearchIndisponivel(new TypeError('undefined is not a function')),
    ).toBe(false);
    expect(elasticsearchIndisponivel('texto')).toBe(false);
  });
});
