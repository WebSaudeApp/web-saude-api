import { hashSha256, durationToSeconds, sha256Matches } from './token.util';

describe('token.util', () => {
  it('gera hash estável e compara em tempo constante', () => {
    const digest = hashSha256('valor-secreto');
    expect(digest).toHaveLength(64);
    expect(sha256Matches('valor-secreto', digest)).toBe(true);
    expect(sha256Matches('outro', digest)).toBe(false);
  });

  it('converte duração JWT em segundos', () => {
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('7d')).toBe(604800);
  });
});
