import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { paginada, PaginacaoQueryDto } from './paginacao-query.dto';

describe('PaginacaoQueryDto (Validações de limites e paginação BE-13 / QA-06)', () => {
  it('aceita valores padrão válidos', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, {});
    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
    expect(dto.pagina).toBe(1);
    expect(dto.limite).toBe(20);
  });

  it('rejeita página menor que 1 (borda inferior)', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, { pagina: 0 });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'pagina')).toBe(true);
  });

  it('aceita página igual a 1 (borda válida)', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, { pagina: 1 });
    const erros = await validate(dto);
    expect(erros.find((e) => e.property === 'pagina')).toBeUndefined();
  });

  it('rejeita limite menor que 1 (borda inferior)', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, { limite: 0 });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'limite')).toBe(true);
  });

  it('aceita limite igual a 100 (borda superior válida)', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, { limite: 100 });
    const erros = await validate(dto);
    expect(erros.find((e) => e.property === 'limite')).toBeUndefined();
  });

  it('rejeita limite maior que 100 (borda superior)', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, { limite: 101 });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'limite')).toBe(true);
  });

  it('rejeita valores não inteiros', async () => {
    const dto = plainToInstance(PaginacaoQueryDto, {
      pagina: 1.5,
      limite: 20.8,
    });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'pagina')).toBe(true);
    expect(erros.some((e) => e.property === 'limite')).toBe(true);
  });
});

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
