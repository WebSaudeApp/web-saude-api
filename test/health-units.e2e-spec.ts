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

jest.setTimeout(60000);

describe('Health units (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService | undefined;
  const suffix = Date.now();
  const ownerEmail = `gestor.a.${suffix}@email.com`;
  const otherEmail = `gestor.b.${suffix}@email.com`;
  const patientEmail = `paciente.${suffix}@email.com`;
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
      const emails = [ownerEmail, otherEmail, patientEmail];
      await prisma.healthUnit.deleteMany({
        where: { owner: { email: { in: emails } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: emails } },
      });
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
    const body = response.body as { accessToken: string };
    return body.accessToken;
  }

  it('cria unidade, impede edição de outro gestor e pagina a busca pública', async () => {
    const ownerToken = await register(ownerEmail, UserRole.FUNCTIONAL);
    const otherToken = await register(otherEmail, UserRole.FUNCTIONAL);
    const patientToken = await register(patientEmail, UserRole.PATIENT);

    await request(app.getHttpServer())
      .post('/health-units')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        name: 'Clínica Paciente',
        type: HealthUnitType.CLINIC,
        street: 'Rua A',
        number: '1',
        city: 'Recife',
        state: 'PE',
        cep: '50000000',
      })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/health-units')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Hospital Teste Recife',
        type: HealthUnitType.HOSPITAL,
        street: 'Rua das Flores',
        number: '100',
        city: 'Recife',
        state: 'PE',
        cep: '50000000',
      })
      .expect(201);

    const createdBody = created.body as {
      id: string;
      approvalStatus: string;
      ownerId: string;
    };
    expect(createdBody.approvalStatus).toBe(ApprovalStatus.DRAFT);

    await request(app.getHttpServer())
      .patch(`/health-units/${createdBody.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Tentativa indevida' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/health-units/${createdBody.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Hospital Teste Recife Atualizado' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/health-units/${createdBody.id}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/health-units/${createdBody.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    if (!prisma) {
      throw new Error('Prisma não inicializado');
    }

    await prisma.healthUnit.update({
      where: { id: createdBody.id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        status: HealthUnitStatus.ACTIVE,
      },
    });

    const listed = await request(app.getHttpServer())
      .get('/health-units')
      .query({ city: 'Recife', page: 1, limit: 1 })
      .expect(200);

    const listedBody = listed.body as {
      data: Array<{ name: string }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    };
    expect(listedBody.meta.page).toBe(1);
    expect(listedBody.meta.limit).toBe(1);
    expect(listedBody.meta.total).toBeGreaterThanOrEqual(1);
    expect(listedBody.data[0].name).toContain('Hospital Teste Recife');
  });
});
