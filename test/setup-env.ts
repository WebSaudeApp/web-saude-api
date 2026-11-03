import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import 'reflect-metadata';
import { extrairHost, validarAmbienteSeguroTestes } from './guard-test-env';

const envTestPath = resolve(__dirname, '../.env.test');
const envDefaultPath = resolve(__dirname, '../.env');
const envPath = existsSync(envTestPath) ? envTestPath : envDefaultPath;

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // QA-07 (#58): Se for o .env comum e contiver DATABASE_URL/DIRECT_URL remota (ex.: Supabase),
    // ignora para testes automatizados, forçando o fallback seguro para localhost.
    if (
      envPath !== envTestPath &&
      (key === 'DATABASE_URL' || key === 'DIRECT_URL') &&
      process.env.ALLOW_REMOTE_TEST_DATABASE !== 'true'
    ) {
      const host = extrairHost(value);
      if (
        host &&
        !['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)
      ) {
        continue;
      }
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/websaude';
process.env.DIRECT_URL ??=
  'postgresql://postgres:postgres@localhost:5432/websaude';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.THROTTLE_TTL_MS ??= '60000';
process.env.THROTTLE_LIMIT ??= '100';
process.env.SWAGGER_ENABLED ??= 'false';
process.env.ELASTICSEARCH_NODE ??= 'http://localhost:9200';

validarAmbienteSeguroTestes(
  process.env.DATABASE_URL,
  process.env.ELASTICSEARCH_NODE,
);
