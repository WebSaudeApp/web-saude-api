import { describe, expect, it } from '@jest/globals';
import { paginada } from './paginacao-query.dto';

describe('paginada (BE-13 - Paginação para o scroll infinito)', () => {
  it('calcula totalPaginas e define temMais como true quando há próximas páginas', () => {
    const resultado = paginada(['item1', 'item2'], 45, 1, 20);

    expect(resultado).toEqual({
      dados: ['item1', 'item2'],
      paginacao: {
        pagina: 1,
        limite: 20,
        total: 45,
        totalPaginas: 3,
        temMais: true,
      },
    });
  });

  it('define temMais como false quando está na última página', () => {
    const resultado = paginada(['item41', 'item45'], 45, 3, 20);

    expect(resultado.paginacao.temMais).toBe(false);
    expect(resultado.paginacao.totalPaginas).toBe(3);
  });

  it('retorna zero páginas e temMais como false quando não há registros', () => {
    const resultado = paginada([], 0, 1, 20);

    expect(resultado).toEqual({
      dados: [],
      paginacao: {
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
        temMais: false,
      },
    });
  });
});
