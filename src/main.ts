import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { setupSwagger } from './docs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 3000);
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (nodeEnv === 'production' && corsOrigins.includes('*')) {
    throw new Error('CORS com origem "*" não é permitido em produção.');
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'docs-assets'), {
    prefix: '/docs-assets/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Sem padrão "conveniente": por omissão nenhum proxy é confiável (req.ip = IP do socket).
  // Em produção TRUST_PROXY é obrigatório e deve ser o número exato de proxies à frente da API.
  const trustProxy = configService.get<string>('TRUST_PROXY', 'false').trim();
  app.set(
    'trust proxy',
    trustProxy === 'false'
      ? false
      : /^\d+$/.test(trustProxy)
        ? Number(trustProxy)
        : trustProxy.split(',').map((item) => item.trim()),
  );

  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', false);

  if (swaggerEnabled) {
    setupSwagger(app);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`API disponível na porta ${port}`);
  if (swaggerEnabled) {
    logger.log(`Documentação disponível em http://localhost:${port}/docs`);
  }
}

void bootstrap();
