import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PapelUsuario } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthTokensDto } from '../src/auth/dto/auth-tokens.dto';
import { PrismaService } from '../src/database/prisma.service';

interface RespostaErro {
  message: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testEmail = `teste_e2e_${Date.now()}@exemplo.com`;

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
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Limpeza de resíduos de teste
    try {
      const user = await prisma.usuario.findUnique({
        where: { email: testEmail },
      });
      if (user) {
        await prisma.sessao.deleteMany({ where: { usuarioId: user.id } });
        await prisma.usuario.delete({ where: { id: user.id } });
      }
    } catch {
      // Ignorar caso já deletado
    }
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('deve retornar 400 se os dados forem inválidos', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: '',
          email: 'invalido',
          senha: '123',
        });

      expect(res.status).toBe(400);
    });

    it('deve retornar 400 se tentar cadastrar papel ADMINISTRADOR', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Admin Invasor',
          email: 'invasor@exemplo.com',
          senha: 'senhaSegura123',
          papel: 'ADMINISTRADOR',
        });

      expect(res.status).toBe(400);
    });

    it('deve cadastrar um novo usuário com sucesso (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Usuária E2E Teste',
          email: testEmail,
          telefone: '81988887777',
          senha: 'senhaSuperSegura123',
          papel: PapelUsuario.PACIENTE,
        });

      expect(res.status).toBe(201);
      const body = res.body as AuthTokensDto;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('expiresIn');
      expect(body).toHaveProperty('usuario');
      expect(body.usuario.email).toBe(testEmail);
      expect(body.usuario.nome).toBe('Usuária E2E Teste');
      expect(body.usuario.papel).toBe(PapelUsuario.PACIENTE);
      expect(body.usuario).not.toHaveProperty('senhaHash');
    });

    it('deve retornar 409 Conflict se tentar cadastrar o mesmo e-mail novamente', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Outro Usuário',
          email: testEmail,
          senha: 'outraSenha123',
          papel: PapelUsuario.PACIENTE,
        });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    it('deve autenticar usuário cadastrado com credenciais corretas (200)', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        email: testEmail,
        senha: 'senhaSuperSegura123',
      });

      expect(res.status).toBe(200);
      const body = res.body as AuthTokensDto;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.usuario.email).toBe(testEmail);
    });

    it('deve retornar 401 Unauthorized com senha errada (anti-enumeração)', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        email: testEmail,
        senha: 'senhaErrada123',
      });

      expect(res.status).toBe(401);
      const body = res.body as RespostaErro;
      expect(body.message).toBe('Credenciais inválidas.');
    });

    it('deve retornar 401 Unauthorized com e-mail inexistente (anti-enumeração)', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'email_nunca_existiu_9999@exemplo.com',
        senha: 'qualquerSenha123',
      });

      expect(res.status).toBe(401);
      const body = res.body as RespostaErro;
      expect(body.message).toBe('Credenciais inválidas.');
    });
  });
});
