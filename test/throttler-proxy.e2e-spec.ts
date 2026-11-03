import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { BuscaService } from '../src/busca/busca.service';

describe('ThrottlerProxy (Rate limit por visitante atrás de proxy - BE-34 #59)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const configMap: Record<string, unknown> = {
      THROTTLE_LIMIT: 2,
      THROTTLE_TTL_MS: 60000,
      FRONTEND_PROXY_SECRET: 'segredo-proxy-e2e',
      NODE_ENV: 'test',
      SWAGGER_ENABLED: false,
      CORS_ORIGINS: 'http://localhost:3000',
      PORT: 3000,
      DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock',
      DIRECT_URL: 'postgresql://mock:mock@localhost:5432/mock',
      ELASTICSEARCH_NODE: 'http://localhost:9200',
      TRUST_PROXY: '1',
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn(
          (key: string, defaultValue?: unknown) =>
            configMap[key] ?? defaultValue,
        ),
        getOrThrow: jest.fn((key: string) => {
          if (configMap[key] !== undefined) return configMap[key];
          throw new Error(`Chave ${key} não configurada`);
        }),
      })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
        isDatabaseConnected: jest.fn().mockResolvedValue(true),
        tipoEstabelecimento: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ nome: 'HOSPITAL' }, { nome: 'CLINICA' }]),
        },
      })
      .overrideProvider(BuscaService)
      .useValue({
        estaDisponivel: jest.fn().mockResolvedValue(true),
      })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    (app as NestExpressApplication).set('trust proxy', true);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('vaza 429 para visitante A após exceder o limite, mantendo visitante B com 200 (baldes isolados)', async () => {
    const server = app.getHttpServer() as App;

    // Visitante A faz 2 requisições permitidas
    await request(server)
      .get('/estabelecimentos/tipos')
      .set('x-frontend-proxy-secret', 'segredo-proxy-e2e')
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);

    await request(server)
      .get('/estabelecimentos/tipos')
      .set('x-frontend-proxy-secret', 'segredo-proxy-e2e')
      .set('x-forwarded-for', '203.0.113.10')
      .expect(200);

    // 3ª requisição do visitante A excede o limite (429)
    await request(server)
      .get('/estabelecimentos/tipos')
      .set('x-frontend-proxy-secret', 'segredo-proxy-e2e')
      .set('x-forwarded-for', '203.0.113.10')
      .expect(429);

    // Visitante B, passando pelo mesmo proxy mas com outro IP, recebe 200 (balde isolado)
    await request(server)
      .get('/estabelecimentos/tipos')
      .set('x-frontend-proxy-secret', 'segredo-proxy-e2e')
      .set('x-forwarded-for', '203.0.113.20')
      .expect(200);
  });

  it('cliente direto que forja x-forwarded-for sem o segredo do proxy não escapa do rate limit', async () => {
    const server = app.getHttpServer() as App;

    // Cliente direto esgota o limite do seu IP real de conexão (127.0.0.1)
    await request(server).get('/estabelecimentos/tipos').expect(200);
    await request(server).get('/estabelecimentos/tipos').expect(200);

    // 3ª requisição: tenta forjar x-forwarded-for para outro IP sem enviar o segredo
    await request(server)
      .get('/estabelecimentos/tipos')
      .set('x-forwarded-for', '8.8.8.8')
      .expect(429);
  });
});
