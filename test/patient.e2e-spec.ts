import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApprovalStatus,
  HealthUnitStatus,
  HealthUnitType,
  UserRole,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(120000);

describe('Patient (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService | undefined;
  const suffix = Date.now();
  const ownerEmail = `gestor.f4.${suffix}@email.com`;
  const patientEmail = `paciente.f4.${suffix}@email.com`;
  const otherEmail = `paciente2.f4.${suffix}@email.com`;
  const password = 'senhaSegura1';
  const userIds: string[] = [];

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
    if (prisma && userIds.length > 0) {
      await prisma.healthUnit.deleteMany({
        where: { ownerId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) {
      await app.close();
    }
  });

  async function register(email: string, role: UserRole): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Usuário Teste',
        email,
        phone: '81999998888',
        password,
        role,
      })
      .expect(201);
    const body = response.body as {
      accessToken: string;
      user: { id: string };
    };
    userIds.push(body.user.id);
    return body.accessToken;
  }

  it('atualiza perfil, favorita, avalia, bloqueia duplicata e encerra a conta', async () => {
    const ownerToken = await register(ownerEmail, UserRole.FUNCTIONAL);
    const patientToken = await register(patientEmail, UserRole.PATIENT);
    const otherToken = await register(otherEmail, UserRole.PATIENT);

    const created = await request(app.getHttpServer())
      .post('/health-units')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Clínica Paciente Fase 4',
        type: HealthUnitType.CLINIC,
        street: 'Rua B',
        number: '20',
        city: 'Olinda',
        state: 'PE',
        cep: '53000000',
      })
      .expect(201);
    const unitId = (created.body as { id: string }).id;

    if (!prisma) {
      throw new Error('Prisma não inicializado');
    }
    await prisma.healthUnit.update({
      where: { id: unitId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        status: HealthUnitStatus.ACTIVE,
      },
    });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ name: 'Paciente Atualizado', phone: '81988887777' })
      .expect(200)
      .expect((res: { body: { name: string } }) => {
        expect(res.body.name).toBe('Paciente Atualizado');
      });

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/favorite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/favorite`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/favorite`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(409);

    const favorites = await request(app.getHttpServer())
      .get('/users/me/favorites')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect((favorites.body as Array<{ unitId: string }>).length).toBe(1);

    const review = await request(app.getHttpServer())
      .post(`/health-units/${unitId}/reviews`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ rating: 5, comment: 'Excelente atendimento.' })
      .expect(201);
    const reviewId = (review.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/reviews`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ rating: 4 })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/reviews`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ rating: 4 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ rating: 1 })
      .expect(403);

    const unit = await request(app.getHttpServer())
      .get(`/health-units/${unitId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const unitBody = unit.body as {
      averageRating: number;
      isFavorite: boolean;
    };
    expect(unitBody.isFavorite).toBe(true);
    expect(unitBody.averageRating).toBe(4.5);

    await request(app.getHttpServer())
      .delete(`/health-units/${unitId}/favorite`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/users/me/password')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ currentPassword: password, newPassword: 'outraSenhaSegura1' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: patientEmail, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: patientEmail, password: 'outraSenhaSegura1' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ password: 'outraSenhaSegura1' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: patientEmail, password: 'outraSenhaSegura1' })
      .expect(401);
  });
});
