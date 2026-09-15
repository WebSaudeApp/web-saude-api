import { paginated } from './pagination-query.dto';

describe('paginated', () => {
  it('calcula totalPages sem estourar o limite', () => {
    expect(paginated([1, 2], 45, 1, 20)).toEqual({
      data: [1, 2],
      meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it('retorna zero páginas quando não há registros', () => {
    expect(paginated([], 0, 1, 20).meta.totalPages).toBe(0);
  });
});
