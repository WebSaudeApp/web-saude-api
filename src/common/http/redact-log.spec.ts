import { parse } from 'node:querystring';
import type { Request } from 'express';
import { sanitizarRotaLog } from './redact-log';

/** Monta a requisição a partir da query string crua, com um parser real. */
function requisicao(caminho: string, queryString: string): Request {
  return {
    path: caminho,
    query: parse(queryString),
  } as unknown as Request;
}

describe('redact-log (BE-31 #53)', () => {
  describe('sanitizarRotaLog', () => {
    it('retorna a rota com os nomes dos parâmetros ordenados e sem valores', () => {
      expect(
        sanitizarRotaLog(
          requisicao(
            '/estabelecimentos',
            'lat=-8.05&lng=-34.88&termo=hospital&cidade=Recife',
          ),
        ),
      ).toBe('/estabelecimentos [cidade,lat,lng,termo]');
    });

    it('retorna apenas o caminho quando não há parâmetros de query', () => {
      expect(sanitizarRotaLog(requisicao('/estabelecimentos/tipos', ''))).toBe(
        '/estabelecimentos/tipos',
      );
    });

    it('coordenada enviada sem `=` não vira nome no log', () => {
      // `?-8.05389&-34.88111`: o parser devolve as coordenadas como NOMES.
      const log = sanitizarRotaLog(
        requisicao('/estabelecimentos', '-8.05389&-34.88111'),
      );

      expect(log).toBe('/estabelecimentos [?x2]');
      expect(log).not.toContain('8.05389');
      expect(log).not.toContain('34.88111');
    });

    it('nome com quebra de linha (log forging) vira marcador, ao lado dos válidos', () => {
      const log = sanitizarRotaLog(
        requisicao(
          '/estabelecimentos',
          'termo=a&x%0A%5BNest%5D%20LOG%20admin%20login=1&lat=1',
        ),
      );

      expect(log).toBe('/estabelecimentos [lat,termo,?x1]');
      expect(log).not.toMatch(/[\r\n]/);
      expect(log).not.toContain('admin');
    });

    it('limita a 20 nomes válidos e conta os inválidos (nome longo demais)', () => {
      const validos = Array.from({ length: 30 }, (_, i) => `p${i}=1`);
      const longo = `${'x'.repeat(41)}=1`;
      const log = sanitizarRotaLog(
        requisicao('/estabelecimentos', [...validos, longo].join('&')),
      );

      const nomes = log.slice(log.indexOf('[') + 1, -1).split(',');
      expect(nomes).toHaveLength(21);
      expect(nomes.filter((n) => /^p\d+$/.test(n))).toHaveLength(20);
      expect(nomes[20]).toBe('?x1');
    });

    it('com rota casada, loga o molde (`:id`) e não o valor posto no caminho', () => {
      const log = sanitizarRotaLog({
        path: '/estabelecimentos/-8.05389,-34.88111',
        baseUrl: '',
        route: { path: '/estabelecimentos/:id' },
        query: {},
      } as unknown as Request);

      expect(log).toBe('/estabelecimentos/:id');
      expect(log).not.toContain('8.05389');
    });

    it('usa url sem query se path for indefinido', () => {
      const mockRequest = {
        url: '/health?check=true',
        query: { check: 'true' },
      } as unknown as Request;

      expect(sanitizarRotaLog(mockRequest)).toBe('/health [check]');
    });
  });
});
