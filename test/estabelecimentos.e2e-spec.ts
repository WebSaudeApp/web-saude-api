import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(60000);

type Estabelecimento = {
  id: string;
  nome: string;
  tipo: { nome: string };
  endereco: { id: string; logradouro: string; bairro: string | null };
  contatos: Array<{ tipo: string; valor: string }>;
  especialidades: Array<{ id: string; nome: string }>;
  horarios: Array<{
    diaSemana: string;
    horaAbertura: string;
    horaFechamento: string;
    atende24h: boolean;
  }>;
  notaMedia: number;
  totalReviews: number;
};

describe('Estabelecimentos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = Date.now();
  const especialidadeNome = `Cardiologia ${suffix}`;
  const unitIds: string[] = [];
  const userIds: string[] = [];
  let especialidadeId: string | undefined;

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
      const units = await prisma.estabelecimento.findMany({
        where: { id: { in: unitIds } },
        select: { enderecoId: true },
      });
      await prisma.estabelecimento.deleteMany({
        where: { id: { in: unitIds } },
      });
      await prisma.endereco.deleteMany({
        where: { id: { in: units.map((unit) => unit.enderecoId) } },
      });
      await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
      if (especialidadeId) {
        await prisma.especialidade.deleteMany({
          where: { id: especialidadeId },
        });
      }
    }
    if (app) {
      await app.close();
    }
  });

  async function criarUsuario(nome: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/usuarios')
      .send({ nome, tipo: 'PATIENT' })
      .expect(201);
    const id = (response.body as { id: string }).id;
    userIds.push(id);
    return id;
  }

  it('cadastra, detalha, edita, busca e remove um estabelecimento', async () => {
    const tipos = await request(app.getHttpServer())
      .get('/estabelecimentos/tipos')
      .expect(200);
    expect((tipos.body as Array<{ nome: string }>).map((t) => t.nome)).toEqual(
      expect.arrayContaining(['HOSPITAL', 'CLINIC']),
    );

    const especialidade = await request(app.getHttpServer())
      .post('/especialidades')
      .send({ nome: especialidadeNome })
      .expect(201);
    especialidadeId = (especialidade.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/estabelecimentos')
      .send({
        nome: 'Tipo inexistente',
        tipo: 'LABORATORIO',
        endereco: {
          cep: '50000000',
          logradouro: 'Rua A',
          numero: '1',
          cidade: 'Recife',
          estado: 'PE',
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/estabelecimentos')
      .send({
        nome: 'Contato inválido',
        tipo: 'HOSPITAL',
        endereco: {
          cep: '50000000',
          logradouro: 'Rua A',
          numero: '1',
          cidade: 'Recife',
          estado: 'PE',
        },
        contatos: [{ tipo: 'EMAIL', valor: 'sem-arroba' }],
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/estabelecimentos')
      .send({
        nome: `Hospital Teste ${suffix}`,
        tipo: 'hospital',
        endereco: {
          cep: '50000-000',
          logradouro: 'Rua das Flores',
          numero: '100',
          bairro: 'Boa Viagem',
          cidade: 'Recife',
          estado: 'pe',
        },
        contatos: [
          { tipo: 'TELEFONE', valor: '8133334444' },
          { tipo: 'EMAIL', valor: 'Contato@Hospital.com' },
        ],
      })
      .expect(201);
    const unit = created.body as Estabelecimento;
    unitIds.push(unit.id);
    expect(unit.tipo.nome).toBe('HOSPITAL');
    expect(unit.endereco).toMatchObject({
      logradouro: 'Rua das Flores',
      bairro: 'Boa Viagem',
    });
    expect(unit.contatos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'TELEFONE', valor: '8133334444' }),
        expect.objectContaining({
          tipo: 'EMAIL',
          valor: 'contato@hospital.com',
        }),
      ]),
    );
    expect(unit.notaMedia).toBe(0);

    const withSpecialties = await request(app.getHttpServer())
      .put(`/estabelecimentos/${unit.id}/especialidades`)
      .send({ especialidadeIds: [especialidadeId] })
      .expect(200);
    expect(
      (withSpecialties.body as Estabelecimento).especialidades.map((e) => e.id),
    ).toEqual([especialidadeId]);

    await request(app.getHttpServer())
      .put(`/estabelecimentos/${unit.id}/horarios`)
      .send({
        horarios: [
          {
            diaSemana: 'SEGUNDA',
            horaAbertura: '18:00',
            horaFechamento: '08:00',
          },
        ],
      })
      .expect(400);

    const withHours = await request(app.getHttpServer())
      .put(`/estabelecimentos/${unit.id}/horarios`)
      .send({
        horarios: [
          {
            diaSemana: 'SEGUNDA',
            horaAbertura: '08:00',
            horaFechamento: '18:00',
          },
          { diaSemana: 'DOMINGO', atende24h: true },
        ],
      })
      .expect(200);
    expect((withHours.body as Estabelecimento).horarios).toEqual([
      expect.objectContaining({
        diaSemana: 'DOMINGO',
        horaAbertura: '00:00',
        horaFechamento: '23:59',
        atende24h: true,
      }),
      expect.objectContaining({
        diaSemana: 'SEGUNDA',
        horaAbertura: '08:00',
        horaFechamento: '18:00',
        atende24h: false,
      }),
    ]);

    const edited = await request(app.getHttpServer())
      .patch(`/estabelecimentos/${unit.id}`)
      .send({
        endereco: { bairro: `Pina ${suffix}` },
        contatos: [{ tipo: 'WHATSAPP', valor: '81999998888' }],
      })
      .expect(200);
    expect((edited.body as Estabelecimento).endereco).toMatchObject({
      logradouro: 'Rua das Flores',
      bairro: `Pina ${suffix}`,
    });
    expect((edited.body as Estabelecimento).contatos).toEqual([
      expect.objectContaining({ tipo: 'WHATSAPP', valor: '81999998888' }),
    ]);

    const autorId = await criarUsuario(`Paciente ${suffix}`);
    const review = await request(app.getHttpServer())
      .post(`/estabelecimentos/${unit.id}/reviews`)
      .send({ autorId, nota: 4, comentario: 'Bom atendimento' })
      .expect(201);
    const reviewId = (review.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/estabelecimentos/${unit.id}/reviews`)
      .send({ autorId, nota: 5 })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/reviews/${reviewId}`)
      .send({ nota: 5 })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/estabelecimentos/${unit.id}`)
      .expect(200);
    expect(detail.body).toMatchObject({ notaMedia: 5, totalReviews: 1 });

    const byAutor = await request(app.getHttpServer())
      .get(`/usuarios/${autorId}/reviews`)
      .expect(200);
    expect(
      (byAutor.body as { data: Array<{ id: string }> }).data.map((r) => r.id),
    ).toEqual([reviewId]);

    const search = await request(app.getHttpServer())
      .get('/estabelecimentos')
      .query({
        search: `Pina ${suffix}`,
        tipo: 'HOSPITAL',
        cidade: 'recife',
        especialidade: especialidadeNome,
        notaMinima: 5,
      })
      .expect(200);
    const searchBody = search.body as {
      data: Estabelecimento[];
      meta: { total: number };
    };
    expect(searchBody.meta.total).toBe(1);
    expect(searchBody.data[0].id).toBe(unit.id);

    await request(app.getHttpServer())
      .delete(`/especialidades/${especialidadeId}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/estabelecimentos/${unit.id}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/estabelecimentos/${unit.id}`)
      .expect(404);
    expect(
      await prisma.endereco.count({ where: { id: unit.endereco.id } }),
    ).toBe(0);
    expect(await prisma.review.count({ where: { id: reviewId } })).toBe(0);
  });
});
