import { arredondarNota } from './nota.util';

describe('arredondarNota', () => {
  it('retorna zero sem avaliações', () => {
    expect(arredondarNota(null)).toBe(0);
  });

  it('arredonda a média em duas casas', () => {
    expect(arredondarNota(13 / 3)).toBe(4.33);
  });
});
