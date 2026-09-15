import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DayOfWeek, HealthUnitType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(120000);

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService | undefined;
  const suffix = Date.now();
  const adminEmail = `admin.f6.${suffix}@email.com`;
  const ownerEmail = `gestor.f6.${suffix}@email.com`;
  const password = 'senhaSegura1';
  const specialtyName = `Neurologia ${suffix}`;
  const extraSpecialty = `Pediatria ${suffix}`;
  let adminId = '';

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
    if (!prisma) {
      throw new Error('Prisma não inicializado');
    }
    const admin = await prisma.user.create({
      data: {
        name: 'Administrador',
        email: adminEmail,
        phone: '81999990000',
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });
    adminId = admin.id;
    await app.init();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.healthUnit.deleteMany({
        where: { owner: { email: ownerEmail } },
      });
      await prisma.specialty.deleteMany({
        where: {
          name: {
            in: [specialtyName, extraSpecialty, `${extraSpecialty} Atualizada`],
          },
        },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [adminEmail, ownerEmail] } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  it('aprova, rejeita, audita e ativa/desativa usuários', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(201);
    const adminToken = (login.body as { accessToken: string }).accessToken;

    const ownerRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Gestor Admin Fase',
        email: ownerEmail,
        phone: '81999998888',
        password,
        role: UserRole.FUNCTIONAL,
      })
      .expect(201);
    const ownerToken = (ownerRegister.body as { accessToken: string })
      .accessToken;
    const ownerId = (ownerRegister.body as { user: { id: string } }).user.id;

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/health-units')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Hospital Painel Admin',
        type: HealthUnitType.HOSPITAL,
        street: 'Rua Admin',
        number: '10',
        city: 'Recife',
        state: 'PE',
        cep: '50000000',
      })
      .expect(201);
    const unitId = (created.body as { id: string }).id;

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
            dayOfWeek: DayOfWeek.TUESDAY,
            openTime: '08:00',
            closeTime: '17:00',
            active: true,
          },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    const pending = await request(app.getHttpServer())
      .get('/admin/health-units/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (pending.body as Array<{ id: string }>).some(
        (item) => item.id === unitId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/admin/health-units/${unitId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Documentação incompleta.' })
      .expect(200);

    const mine = await request(app.getHttpServer())
      .get('/health-units/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(
      (mine.body as Array<{ id: string; rejectionReason: string | null }>).find(
        (item) => item.id === unitId,
      )?.rejectionReason,
    ).toBe('Documentação incompleta.');

    await request(app.getHttpServer())
      .patch(`/health-units/${unitId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'Pronto para nova análise.' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/health-units/${unitId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/admin/health-units/${unitId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/health-units/${unitId}`)
      .expect(200);

    const dashboard = await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (dashboard.body as { pendingUnits: number }).pendingUnits,
    ).toBeGreaterThanOrEqual(0);

    await request(app.getHttpServer())
      .patch(`/admin/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/users/${ownerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/admin/users/${ownerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);

    const createdSpecialty = await request(app.getHttpServer())
      .post('/admin/specialties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: extraSpecialty })
      .expect(201);
    const extraId = (createdSpecialty.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/admin/specialties/${extraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${extraSpecialty} Atualizada` })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/specialties/${extraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const audit = await request(app.getHttpServer())
      .get('/admin/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const actions = (
      audit.body as { data: Array<{ action: string }> }
    ).data.map((item) => item.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'UNIT_REJECTED',
        'UNIT_APPROVED',
        'USER_DEACTIVATED',
        'USER_ACTIVATED',
        'SPECIALTY_CREATED',
      ]),
    );
  });
});
