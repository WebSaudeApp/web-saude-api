import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { join } from 'path';

export function setupSwagger(app: INestApplication): void {
  const builder = new DocumentBuilder()
    .setTitle('Web Saúde API')
    .setDescription(
      'API da plataforma Web Saúde para busca e consulta de unidades de saúde.',
    )
    .setVersion('0.1.0');

  const prodUrl = process.env.PRODUCTION_URL;
  if (prodUrl) {
    builder.addServer(prodUrl, 'Produção (Hospedagem Definitiva)');
  }
  builder
    .addServer(
      'https://web-saude-api.onrender.com',
      'Ambiente de Teste (Render)',
    )
    .addServer('http://localhost:3000', 'Ambiente Local (Desenvolvimento)');

  const config = builder
    .addTag(
      'Disponibilidade',
      'Status da API e conexão com o PostgreSQL e Elasticsearch',
    )
    .addTag(
      'Estabelecimentos',
      'Busca e cadastro de estabelecimentos, horários, especialidades e fotos',
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
