/**
 * QA-07 (#58): Guarda de segurança para isolamento do ambiente de testes
 *
 * Impede que suítes de teste (especialmente E2E/integração) executem contra
 * bancos de dados remotos ou instâncias de produção (ex.: Supabase, RDS, Elastic cloud),
 * evitando vazamento, destruição de dados reais ou criação de registros órfãos.
 */

export const ALLOWED_TEST_HOSTS = new Set([
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

export function hostLocalAutorizado(valor?: string): boolean {
  const host = extrairHost(valor);
  return host !== null && ALLOWED_TEST_HOSTS.has(host);
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
  // Falha fechada: valor preenchido cujo host nao da para extrair tambem e bloqueado.
  if (dbUrl && (!dbHost || !ALLOWED_TEST_HOSTS.has(dbHost))) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: DATABASE_URL aponta para um host remoto/não reconhecido ('${dbHost ?? 'ilegível'}'). ` +
        `Para testes E2E e de integração, utilize serviços locais (ex.: docker compose com localhost:5432). ` +
        `Caso realmente deseje rodar testes contra este host remoto, defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }

  const esHost = extrairHost(esNode);
  if (esNode && (!esHost || !ALLOWED_TEST_HOSTS.has(esHost))) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: ELASTICSEARCH_NODE aponta para um host remoto/não reconhecido ('${esHost ?? 'ilegível'}'). ` +
        `Para testes E2E e de integração, utilize serviços locais (ex.: docker compose com localhost:9200). ` +
        `Caso realmente deseje rodar testes contra este host remoto, defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }
}
