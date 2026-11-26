import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter (BE-31 #53)', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loga erro 503 com a rota e apenas os nomes dos parâmetros, sem vazar valores sensíveis', () => {
    const mockRequest = {
      method: 'GET',
      path: '/estabelecimentos',
      originalUrl:
        '/estabelecimentos?lat=-8.05389&lng=-34.88111&especialidade=Cardiologia&termo=ClinicaSigilosaQ7',
      url: '/estabelecimentos?lat=-8.05389&lng=-34.88111&especialidade=Cardiologia&termo=ClinicaSigilosaQ7',
      query: {
        lat: '-8.05389',
        lng: '-34.88111',
        especialidade: 'Cardiologia',
        termo: 'ClinicaSigilosaQ7',
      },
    };

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;

    const exception503 = new HttpException(
      'Serviço Indisponível',
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    filter.catch(exception503, mockHost);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const chamadas = errorSpy.mock.calls as unknown as Array<[string]>;
    const logMsg = chamadas[0][0];

    // Deve conter rota, nomes dos parâmetros e status
    expect(logMsg).toBe(
      'GET /estabelecimentos [especialidade,lat,lng,termo] 503',
    );

    // NUNCA deve conter valores sensíveis
    expect(logMsg).not.toContain('-8.05389');
    expect(logMsg).not.toContain('-34.88111');
    expect(logMsg).not.toContain('Cardiologia');
    expect(logMsg).not.toContain('ClinicaSigilosaQ7');
  });

  it('loga erro 500 genérico sem vazar valores de query', () => {
    const mockRequest = {
      method: 'GET',
      path: '/estabelecimentos',
      originalUrl:
        '/estabelecimentos?lat=-8.05389&lng=-34.88111&especialidade=especialidadeunica&termo=termounico',
      url: '/estabelecimentos?lat=-8.05389&lng=-34.88111&especialidade=especialidadeunica&termo=termounico',
      query: {
        lat: '-8.05389',
        lng: '-34.88111',
        especialidade: 'especialidadeunica',
        termo: 'termounico',
      },
    };

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;

    const error500 = new Error('Falha no banco relacional');

    filter.catch(error500, mockHost);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const chamadas = errorSpy.mock.calls as unknown as Array<[string]>;
    const logMsg = chamadas[0][0];

    expect(logMsg).toBe(
      'GET /estabelecimentos [especialidade,lat,lng,termo] 500',
    );
    for (const valor of Object.values(mockRequest.query)) {
      expect(logMsg).not.toContain(valor);
    }
  });
});
