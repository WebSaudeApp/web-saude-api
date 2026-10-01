import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(60000);

type Usuario = {
  id: string;
  nome: string;
  cpf: string | null;
  genero: string | null;
  tipo: { nome: string };
  endereco: { id: string; cidade: string; bairro: string | null } | null;
  contatos: Array<{ tipo: string; valor: string }>;
};

describe('Usuários (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = Date.now();
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
    if (prisma) {
      const users = await prisma.usuario.findMany({
        where: { id: { in: userIds } },
        select: { enderecoId: true },
      });
      await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
      const enderecoIds = users
        .map((user) => user.enderecoId)
        .filter((id): id is string => id !== null);
      await prisma.endereco.deleteMany({ where: { id: { in: enderecoIds } } });
    }
    if (app) {
      await app.close();
    }
  });

  it('cadastra, edita e remove um usuário com endereço e contatos', async () => {
    const tipos = await request(app.getHttpServer())
      .get('/usuarios/tipos')
      .expect(200);
    expect((tipos.body as Array<{ nome: string }>).map((t) => t.nome)).toEqual(
      expect.arrayContaining(['PATIENT', 'FUNCTIONAL', 'ADMIN']),
    );

    await request(app.getHttpServer())
      .post('/usuarios')
      .send({ nome: 'Tipo inválido', tipo: 'VISITANTE' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/usuarios')
      .send({ nome: 'CPF inválido', tipo: 'PATIENT', cpf: '123' })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/usuarios')
      .send({
        nome: `Maria ${suffix}`,
        cpf: '123.456.789-09',
        genero: 'Feminino',
        tipo: 'patient',
        contatos: [{ tipo: 'EMAIL', valor: 'Maria@Email.com' }],
      })
      .expect(201);
    const user = created.body as Usuario;
    userIds.push(user.id);
    expect(user).toMatchObject({
      cpf: '12345678909',
      genero: 'Feminino',
      tipo: { nome: 'PATIENT' },
      endereco: null,
      contatos: [expect.objectContaining({ valor: 'maria@email.com' })],
    });

    await request(app.getHttpServer())
      .patch(`/usuarios/${user.id}`)
      .send({ endereco: { bairro: 'Centro' } })
      .expect(400);

    const withAddress = await request(app.getHttpServer())
      .patch(`/usuarios/${user.id}`)
      .send({
        endereco: {
          cep: '50000000',
          logradouro: 'Rua B',
          numero: '20',
          cidade: 'Olinda',
          estado: 'PE',
        },
      })
      .expect(200);
    expect((withAddress.body as Usuario).endereco).toMatchObject({
      cidade: 'Olinda',
      bairro: null,
    });

    const moved = await request(app.getHttpServer())
      .patch(`/usuarios/${user.id}`)
      .send({ endereco: { bairro: 'Carmo' } })
      .expect(200);
    expect((moved.body as Usuario).endereco).toMatchObject({
      cidade: 'Olinda',
      bairro: 'Carmo',
    });

    const listed = await request(app.getHttpServer())
      .get('/usuarios')
      .query({ page: 1, limit: 100 })
      .expect(200);
    expect(
      (listed.body as { data: Usuario[] }).data.map((item) => item.id),
    ).toContain(user.id);

    const enderecoId = (moved.body as Usuario).endereco!.id;
    await request(app.getHttpServer())
      .delete(`/usuarios/${user.id}`)
      .expect(200);
    await request(app.getHttpServer()).get(`/usuarios/${user.id}`).expect(404);
    expect(await prisma.endereco.count({ where: { id: enderecoId } })).toBe(0);
    expect(await prisma.contato.count({ where: { usuarioId: user.id } })).toBe(
      0,
    );
  });
});
