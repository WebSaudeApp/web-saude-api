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
