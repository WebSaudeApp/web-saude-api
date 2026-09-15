import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApprovalStatus,
  DayOfWeek,
  HealthUnitStatus,
  HealthUnitType,
  UserRole,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(120000);

describe('Manager workflow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService | undefined;
  const suffix = Date.now();
  const ownerEmail = `gestor.f5.${suffix}@email.com`;
  const otherEmail = `gestor2.f5.${suffix}@email.com`;
  const password = 'senhaSegura1';
  const specialtyName = `Cardiologia ${suffix}`;

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
      await prisma.healthUnit.deleteMany({
        where: { owner: { email: { in: [ownerEmail, otherEmail] } } },
      });
      await prisma.specialty.deleteMany({ where: { name: specialtyName } });
      await prisma.user.deleteMany({
        where: { email: { in: [ownerEmail, otherEmail] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  async function register(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Gestor Teste',
        email,
        phone: '81999998888',
        password,
        role: UserRole.FUNCTIONAL,
      })
      .expect(201);
    return (response.body as { accessToken: string }).accessToken;
  }

  it('envia rascunho, bloqueia edição em análise, mostra rejeição e republica', async () => {
    const ownerToken = await register(ownerEmail);
    const otherToken = await register(otherEmail);

    const created = await request(app.getHttpServer())
      .post('/health-units')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Clínica Fluxo Gestor',
        type: HealthUnitType.CLINIC,
        street: 'Rua C',
        number: '30',
        city: 'Jaboatão',
        state: 'PE',
        cep: '54000000',
      })
      .expect(201);
    const unitId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);

    const specialty = await request(app.getHttpServer())
      .post('/specialties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: specialtyName })
      .expect(201);
    const specialtyId = (specialty.body as { id: string }).id;

    await request(app.getHttpServer())
      .put(`/health-units/${unitId}/specialties`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ specialtyIds: [specialtyId] })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/health-units/${unitId}/opening-hours`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        hours: [
          {
            dayOfWeek: DayOfWeek.MONDAY,
            openTime: '08:00',
            closeTime: '18:00',
            active: true,
          },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    const submitted = await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect((submitted.body as { approvalStatus: string }).approvalStatus).toBe(
      ApprovalStatus.PENDING,
    );

    await request(app.getHttpServer())
      .patch(`/health-units/${unitId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Tentativa durante análise' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/withdraw`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201)
      .expect((res: { body: { approvalStatus: string } }) => {
        expect(res.body.approvalStatus).toBe(ApprovalStatus.DRAFT);
      });

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    if (!prisma) {
      throw new Error('Prisma não inicializado');
    }
    await prisma.healthUnit.update({
      where: { id: unitId },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        rejectionReason: 'Endereço incompleto.',
        status: HealthUnitStatus.INACTIVE,
      },
    });

    const mine = await request(app.getHttpServer())
      .get('/health-units/mine')
      .query({ approvalStatus: ApprovalStatus.REJECTED })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const mineBody = mine.body as Array<{
      id: string;
      rejectionReason: string | null;
    }>;
    expect(mineBody[0].id).toBe(unitId);
    expect(mineBody[0].rejectionReason).toBe('Endereço incompleto.');

    await request(app.getHttpServer())
      .patch(`/health-units/${unitId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ complement: 'Sala 2' })
      .expect(200);

    const resubmitted = await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const resubmittedBody = resubmitted.body as {
      approvalStatus: string;
      rejectionReason: string | null;
    };
    expect(resubmittedBody.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(resubmittedBody.rejectionReason).toBeNull();

    await prisma.healthUnit.update({
      where: { id: unitId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        status: HealthUnitStatus.ACTIVE,
      },
    });

    await request(app.getHttpServer())
      .patch(`/health-units/${unitId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: HealthUnitStatus.INACTIVE })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/health-units/${unitId}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/health-units/${unitId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: HealthUnitStatus.ACTIVE })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/health-units/${unitId}`)
      .expect(200);
  });
});
