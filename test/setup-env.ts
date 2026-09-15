import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env');
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
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-change-me-32chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-change-me-32chars';
process.env.JWT_ACCESS_EXPIRES ??= '15m';
process.env.JWT_REFRESH_EXPIRES ??= '7d';
