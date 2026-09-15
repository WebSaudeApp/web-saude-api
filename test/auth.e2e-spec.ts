import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(60000);

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService | undefined;
  const email = `fase2.${Date.now()}@email.com`;
  const password = 'senhaSegura1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email } });
    }
    if (app) {
      await app.close();
    }
  });

  it('registra, faz login, bloqueia senha errada e protege rotas', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Paciente Teste',
        email,
        phone: '81999998888',
        password,
        role: UserRole.PATIENT,
      })
      .expect(201);

    const registerBody = register.body as {
      accessToken: string;
      debugCode: string;
      user: { email: string; passwordHash?: string };
    };

    expect(registerBody.accessToken).toBeDefined();
    expect(registerBody.user.passwordHash).toBeUndefined();
    const accessToken = registerBody.accessToken;
    const debugCode = registerBody.debugCode;

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senhaErrada' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    await request(app.getHttpServer()).get('/users/me').expect(401);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res: { body: { email: string } }) => {
        expect(res.body.email).toBe(email);
      });

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, code: debugCode })
      .expect(201);

    const forgot = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(201);

    const forgotBody = forgot.body as { debugToken: string };

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: forgotBody.debugToken,
        password: 'novaSenhaSegura1',
      })
      .expect(201);
  });
});
