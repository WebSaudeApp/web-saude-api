import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import {
  AMOSTRAS_DIAGNOSTICO_PROXY,
  AppThrottlerGuard,
} from './app-throttler.guard';

describe('AppThrottlerGuard (Rate limit por visitante atrás de proxy - BE-34 #59)', () => {
  let guard: AppThrottlerGuard;
  let configService: ConfigService;

  const mockOptions: ThrottlerModuleOptions = {
    throttlers: [{ ttl: 60000, limit: 100 }],
  };
  const mockStorageService = {
    increment: jest.fn(),
  } as unknown as ThrottlerStorage;
  const mockReflector = new Reflector();

  function createGuard(configs: Record<string, string | number | undefined>) {
    configService = {
      get: jest.fn(
        (key: string, defaultValue?: unknown) => configs[key] ?? defaultValue,
      ),
    } as unknown as ConfigService;

    return new AppThrottlerGuard(
      mockOptions,
      mockStorageService,
      mockReflector,
      configService,
    );
  }

  it('usa o IP real do visitante quando a requisição vem do proxy com segredo correto', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-frontend-proxy-secret': 'segredo-super-seguro',
        'x-frontend-visitor-ip': '203.0.113.195',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('proxy:203.0.113.195');
  });

  it('usa o primeiro IP válido quando o cabeçalho do visitante chega duplicado/lista', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-frontend-proxy-secret': 'segredo-super-seguro',
        'x-frontend-visitor-ip': 'lixo, 203.0.113.7, 198.51.100.9',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('proxy:203.0.113.7');
  });

  it('ignora x-forwarded-for (cadeia forjável) e IP inválido no cabeçalho do visitante', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-frontend-proxy-secret': 'segredo-super-seguro',
        'x-frontend-visitor-ip': 'nao-e-ip',
        'x-forwarded-for': '1.2.3.4, 203.0.113.195',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('direct:10.0.0.1');
  });

  it('ignora x-forwarded-for forjado quando não há segredo de proxy válido (usa req.ip resolvido pelo Express)', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '198.51.100.22',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-forwarded-for': '8.8.8.8',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('direct:198.51.100.22');
  });

  it('ignora x-forwarded-for quando o segredo enviado é incorreto', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '198.51.100.22',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-frontend-proxy-secret': 'segredo-incorreto',
        'x-forwarded-for': '8.8.8.8',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('direct:198.51.100.22');
  });

  it('faz fallback para 127.0.0.1 caso socket e req.ip não estejam definidos', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      headers: {},
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('direct:127.0.0.1');
  });

  it('diagnóstico de proxy recomenda o MÍNIMO de saltos da amostra, ignorando XFF forjado', async () => {
    guard = createGuard({ TRUST_PROXY: '1' });
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const tracker = guard as unknown as {
      getTracker: (r: unknown) => Promise<string>;
    };

    // 1ª requisição forjada pelo cliente (3 entradas); as demais vêm só do proxy (1 entrada).
    await tracker.getTracker({
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.5' },
    });
    expect(logSpy).not.toHaveBeenCalled();
    for (let i = 1; i < AMOSTRAS_DIAGNOSTICO_PROXY; i++) {
      await tracker.getTracker({
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.5' },
      });
    }

    expect(logSpy).toHaveBeenCalledTimes(1);
    const mensagem = String(logSpy.mock.calls[0][0]);
    expect(mensagem).toContain('Valor sugerido: 1');
    expect(mensagem).not.toContain('203.0.113.5');
    logSpy.mockRestore();
  });
});
