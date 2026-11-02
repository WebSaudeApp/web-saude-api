import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor (BE-31 #53)', () => {
  let interceptor: RequestLoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loga a rota e apenas os nomes dos parâmetros da query em ordem, sem vazar valores (sucesso)', async () => {
    const mockRequest = {
      method: 'GET',
      path: '/estabelecimentos',
      originalUrl:
        '/estabelecimentos?lat=-8.05389&lng=-34.88111&especialidade=Cardiologia&termo=x',
      url: '/estabelecimentos?lat=-8.05389&lng=-34.88111&especialidade=Cardiologia&termo=x',
      query: {
        lat: '-8.05389',
        lng: '-34.88111',
        especialidade: 'Cardiologia',
        termo: 'x',
      },
    };

    const mockResponse = {
      statusCode: 200,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of('resultado'),
    };

    await firstValueFrom(interceptor.intercept(mockContext, mockHandler));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const chamadas = logSpy.mock.calls as unknown as Array<[string]>;
    const logMsg = chamadas[0][0];

    // Deve conter a rota e os nomes dos parâmetros ordenados
    expect(logMsg).toContain(
      'GET /estabelecimentos [especialidade,lat,lng,termo] 200',
    );

    // NUNCA deve conter os valores sensíveis (coordenadas, termo, especialidade)
    expect(logMsg).not.toContain('-8.05389');
    expect(logMsg).not.toContain('-34.88111');
    expect(logMsg).not.toContain('Cardiologia');
    expect(logMsg).not.toContain('termo=x');
  });

  it('loga a rota e apenas os nomes dos parâmetros em caso de erro', async () => {
    const mockRequest = {
      method: 'GET',
      path: '/estabelecimentos',
      originalUrl: '/estabelecimentos?lat=-8.05389&lng=-34.88111',
      url: '/estabelecimentos?lat=-8.05389&lng=-34.88111',
      query: {
        lat: '-8.05389',
        lng: '-34.88111',
      },
    };

    const mockResponse = {
      statusCode: 500,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => throwError(() => new Error('Falha')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(mockContext, mockHandler)),
    ).rejects.toThrow('Falha');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const chamadas = warnSpy.mock.calls as unknown as Array<[string]>;
    const logMsg = chamadas[0][0];

    expect(logMsg).toContain('GET /estabelecimentos [lat,lng] failed');
    expect(logMsg).not.toContain('-8.05389');
    expect(logMsg).not.toContain('-34.88111');
  });

  it('loga a rota sem colchetes quando não há query parameters', async () => {
    const mockRequest = {
      method: 'GET',
      path: '/estabelecimentos/tipos',
      originalUrl: '/estabelecimentos/tipos',
      url: '/estabelecimentos/tipos',
      query: {},
    };

    const mockResponse = {
      statusCode: 200,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of('resultado'),
    };

    await firstValueFrom(interceptor.intercept(mockContext, mockHandler));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const chamadas = logSpy.mock.calls as unknown as Array<[string]>;
    const logMsg = chamadas[0][0];

    expect(logMsg).toContain('GET /estabelecimentos/tipos 200');
    expect(logMsg).not.toContain('[');
  });
});
