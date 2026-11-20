import { validate } from './env.validation';

const base = {
  NODE_ENV: 'production',
  PORT: '3000',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  THROTTLE_TTL_MS: '60000',
  THROTTLE_LIMIT: '100',
  SWAGGER_ENABLED: 'false',
  ELASTICSEARCH_NODE: 'http://localhost:9200',
  TRUST_PROXY: '1',
};

describe('validate (FRONTEND_PROXY_SECRET)', () => {
  it('exige o segredo em producao', () => {
    expect(() => validate(base)).toThrow(/FRONTEND_PROXY_SECRET/);
  });

  it('rejeita segredo curto em producao', () => {
    expect(() => validate({ ...base, FRONTEND_PROXY_SECRET: 'curto' })).toThrow(
      /FRONTEND_PROXY_SECRET/,
    );
  });

  it('aceita segredo com 32+ caracteres em producao', () => {
    expect(() =>
      validate({ ...base, FRONTEND_PROXY_SECRET: 'x'.repeat(32) }),
    ).not.toThrow();
  });

  it('e opcional fora de producao', () => {
    expect(() => validate({ ...base, NODE_ENV: 'development' })).not.toThrow();
  });

  it('exige TRUST_PROXY numérico em produção', () => {
    const { TRUST_PROXY: _omitido, ...semTrustProxy } = base;
    void _omitido;
    const segredo = { FRONTEND_PROXY_SECRET: 'x'.repeat(32) };
    expect(() => validate({ ...semTrustProxy, ...segredo })).toThrow(
      /TRUST_PROXY/,
    );
    expect(() =>
      validate({ ...base, ...segredo, TRUST_PROXY: 'true' }),
    ).toThrow(/TRUST_PROXY/);
  });

  it('aceita TRUST_PROXY numérico, false e lista CIDR/keywords; rejeita true', () => {
    const segredo = { FRONTEND_PROXY_SECRET: 'x'.repeat(32) };
    for (const valor of [
      '1',
      '2',
      'false',
      'loopback, 10.0.0.0/8',
      'uniquelocal',
    ]) {
      expect(() =>
        validate({ ...base, ...segredo, TRUST_PROXY: valor }),
      ).not.toThrow();
    }
    expect(() =>
      validate({ ...base, ...segredo, TRUST_PROXY: 'true' }),
    ).toThrow(/TRUST_PROXY/);
  });
});
