import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { join } from 'path';

export function setupSwagger(app: INestApplication): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const builder = new DocumentBuilder()
    .setTitle('Web Saúde API')
    .setDescription(
      'API da plataforma Web Saúde para busca e consulta de unidades de saúde.',
    )
    .setVersion('0.1.0');

  if (isProduction) {
    builder
      .addServer('https://web-saude-api.onrender.com', 'Produção')
      .addServer('http://localhost:3000', 'Local');
  } else {
    builder
      .addServer('http://localhost:3000', 'Local')
      .addServer('https://web-saude-api.onrender.com', 'Produção');
  }

  const config = builder
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    .addTag('Disponibilidade', 'Status da API e conexão com o PostgreSQL')
    .addTag(
      'Autenticação',
      'Cadastro, login, JWT, verificação de e-mail e recuperação de senha',
    )
    .addTag(
      'Usuários',
      'Perfil, senha, favoritos e avaliações do usuário autenticado',
    )
    .addTag('Unidades de saúde', 'Busca pública e gestão das unidades')
    .addTag('Especialidades', 'Lista e cadastro de especialidades médicas')
    .addTag('Avaliações', 'Edição e exclusão da própria avaliação')
    .addTag(
      'Administração',
      'Painel do ADMIN: aprovação, usuários, especialidades e auditoria',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('openapi', app, document, {
    ui: false,
    jsonDocumentUrl: '/docs-json',
  });

  const index = join(process.cwd(), 'docs-assets', 'index.html');
  const httpAdapter = app.getHttpAdapter();
  const sendPortal = (_req: Request, res: Response) => {
    res.type('html');
    res.sendFile(index);
  };

  httpAdapter.get('/docs', sendPortal);
  try {
    httpAdapter.get('/docs/', sendPortal);
  } catch {
    // alguns adapters não aceitam a rota duplicada com barra
  }
}
