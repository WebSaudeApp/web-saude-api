/**
 * QA-07 (#58): Guarda de segurança para isolamento do ambiente de testes
 *
 * Impede que suítes de teste (especialmente E2E/integração) executem contra
 * bancos de dados remotos ou instâncias de produção (ex.: Supabase, RDS, Elastic cloud),
 * evitando vazamento, destruição de dados reais ou criação de registros órfãos.
 */

const ALLOWED_TEST_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'elasticsearch',
]);

export function extrairHost(urlStr?: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') {
    return null;
  }
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase();
  } catch {
    // Fallback para strings de conexão onde new URL possa falhar
    const match = urlStr.match(/@([^:/]+)/);
    return match && match[1] ? match[1].toLowerCase() : null;
  }
}

export function validarAmbienteSeguroTestes(
  dbUrl?: string,
  esNode?: string,
  allowRemote = process.env.ALLOW_REMOTE_TEST_DATABASE === 'true',
): void {
  if (allowRemote) {
    return;
  }

  const dbHost = extrairHost(dbUrl);
  if (dbHost && !ALLOWED_TEST_HOSTS.has(dbHost)) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: DATABASE_URL aponta para um host remoto não-local ('${dbHost}'). ` +
        `Para testes E2E e de integração, utilize serviços locais (ex.: docker compose com localhost:5432). ` +
        `Caso realmente deseje rodar testes contra este host remoto, defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }

  const esHost = extrairHost(esNode);
  if (esHost && !ALLOWED_TEST_HOSTS.has(esHost)) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: ELASTICSEARCH_NODE aponta para um host remoto não-local ('${esHost}'). ` +
        `Para testes E2E e de integração, utilize serviços locais (ex.: docker compose com localhost:9200). ` +
        `Caso realmente deseje rodar testes contra este host remoto, defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }
}
