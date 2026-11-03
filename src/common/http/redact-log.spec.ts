import type { Request } from 'express';
import { redactLogRecord, sanitizarRotaLog } from './redact-log';

describe('redact-log (BE-31 #53)', () => {
  describe('redactLogRecord', () => {
    it('oculta senha, token e authorization', () => {
      expect(
        redactLogRecord({
          method: 'POST',
          password: 'senhaSegura1',
          accessToken: 'abc',
          authorization: 'Bearer xyz',
          email: 'maria@email.com',
        }),
      ).toEqual({
        method: 'POST',
        password: '[redacted]',
        accessToken: '[redacted]',
        authorization: '[redacted]',
        email: 'maria@email.com',
      });
    });
  });

  describe('sanitizarRotaLog', () => {
    it('retorna a rota com os nomes dos parâmetros ordenados e sem valores', () => {
      const mockRequest = {
        path: '/estabelecimentos',
        query: {
          lat: '-8.05',
          lng: '-34.88',
          termo: 'hospital',
          cidade: 'Recife',
        },
      } as unknown as Request;

      expect(sanitizarRotaLog(mockRequest)).toBe(
        '/estabelecimentos [cidade,lat,lng,termo]',
      );
    });

    it('retorna apenas o caminho quando não há parâmetros de query', () => {
      const mockRequest = {
        path: '/estabelecimentos/tipos',
        query: {},
      } as unknown as Request;

      expect(sanitizarRotaLog(mockRequest)).toBe('/estabelecimentos/tipos');
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
