import { computeAverageRating } from './review-rating.util';

describe('computeAverageRating', () => {
  it('retorna zero sem avaliações', () => {
    expect(computeAverageRating([])).toBe(0);
  });

  it('arredonda a média em duas casas', () => {
    expect(computeAverageRating([5, 4, 4])).toBe(4.33);
  });
});
