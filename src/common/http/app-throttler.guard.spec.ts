import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

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
        'x-forwarded-for': '203.0.113.195',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('proxy:203.0.113.195');
  });

  it('extrai o primeiro IP quando x-forwarded-for contém cadeia de proxies', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-frontend-proxy-secret': 'segredo-super-seguro',
        'x-forwarded-for': '203.0.113.195, 10.0.0.2, 10.0.0.3',
      },
    };

    const tracker = await (
      guard as unknown as { getTracker: (r: unknown) => Promise<string> }
    ).getTracker(req);
    expect(tracker).toBe('proxy:203.0.113.195');
  });

  it('ignora x-forwarded-for forjado quando não há segredo de proxy válido (usa socket.remoteAddress)', async () => {
    guard = createGuard({
      FRONTEND_PROXY_SECRET: 'segredo-super-seguro',
      NODE_ENV: 'production',
    });

    const req = {
      ip: '8.8.8.8',
      socket: { remoteAddress: '198.51.100.22' },
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
      ip: '8.8.8.8',
      socket: { remoteAddress: '198.51.100.22' },
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
});
