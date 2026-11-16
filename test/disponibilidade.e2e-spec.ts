import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { BuscaService } from '../src/busca/busca.service';

describe('Disponibilidade (e2e)', () => {
  let app: INestApplication<App>;
  const estaDisponivel = jest.fn().mockResolvedValue(true);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        isDatabaseConnected: jest.fn().mockResolvedValue(true),
      })
      .overrideProvider(BuscaService)
      .useValue({
        estaDisponivel,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health retorna status ok com banco e elasticsearch conectados', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      banco: 'conectado',
      elasticsearch: 'conectado',
    });
  });

  it('GET /health responde 200 com status degradado quando só o elasticsearch está fora', async () => {
    estaDisponivel.mockResolvedValueOnce(false);
    await request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'degradado',
      banco: 'conectado',
      elasticsearch: 'desconectado',
    });
  });

  it('GET /disponibilidade retorna status ok', () => {
    return request(app.getHttpServer())
      .get('/disponibilidade')
      .expect(200)
      .expect({
        status: 'ok',
        banco: 'conectado',
        elasticsearch: 'conectado',
      });
  });

  it('GET / retorna api online', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      mensagem: 'api online',
    });
  });
});
