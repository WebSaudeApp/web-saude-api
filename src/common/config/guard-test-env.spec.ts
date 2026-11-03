import { extrairHost, validarAmbienteSeguroTestes } from './guard-test-env';

describe('QA-07: Guarda de isolamento do ambiente de testes', () => {
  describe('extrairHost', () => {
    it('extrai hostname de URLs padrão e postgresql', () => {
      expect(extrairHost('http://localhost:9200')).toBe('localhost');
      expect(extrairHost('http://127.0.0.1:9200')).toBe('127.0.0.1');
      expect(
        extrairHost('postgresql://postgres:postgres@localhost:5432/websaude'),
      ).toBe('localhost');
      expect(
        extrairHost(
          'postgresql://postgres:pass@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
        ),
      ).toBe('aws-0-us-west-2.pooler.supabase.com');
    });

    it('retorna null para valores inválidos ou vazios', () => {
      expect(extrairHost('')).toBeNull();
      expect(extrairHost(undefined)).toBeNull();
    });
  });

  describe('validarAmbienteSeguroTestes', () => {
    it('permite hosts locais autorizados (localhost, 127.0.0.1, ::1, postgres, elasticsearch)', () => {
      expect(() =>
        validarAmbienteSeguroTestes(
          'postgresql://postgres:postgres@localhost:5432/websaude',
          'http://localhost:9200',
        ),
      ).not.toThrow();

      expect(() =>
        validarAmbienteSeguroTestes(
          'postgresql://postgres:postgres@127.0.0.1:5432/websaude',
          'http://127.0.0.1:9200',
        ),
      ).not.toThrow();

      expect(() =>
        validarAmbienteSeguroTestes(
          'postgresql://postgres:postgres@postgres:5432/websaude',
          'http://elasticsearch:9200',
        ),
      ).not.toThrow();
    });

    it('bloqueia DATABASE_URL apontando para Supabase ou outro host remoto', () => {
      expect(() =>
        validarAmbienteSeguroTestes(
          'postgresql://postgres:pass@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
          'http://localhost:9200',
        ),
      ).toThrow(
        /Execução de testes abortada: DATABASE_URL aponta para um host remoto não-local/,
      );
    });

    it('bloqueia ELASTICSEARCH_NODE apontando para host remoto', () => {
      expect(() =>
        validarAmbienteSeguroTestes(
          'postgresql://postgres:postgres@localhost:5432/websaude',
          'https://my-cloud-es.es.io:9243',
        ),
      ).toThrow(
        /Execução de testes abortada: ELASTICSEARCH_NODE aponta para um host remoto não-local/,
      );
    });

    it('permite host remoto quando allowRemote for explicitamente true', () => {
      expect(() =>
        validarAmbienteSeguroTestes(
          'postgresql://postgres:pass@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
          'https://my-cloud-es.es.io:9243',
          true,
        ),
      ).not.toThrow();
    });
  });
});
