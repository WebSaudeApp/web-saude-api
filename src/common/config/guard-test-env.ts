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

const normalizarHost = (host: string): string =>
  host.replace(/^\[|\]$/g, '').toLowerCase();

/**
 * Todos os hosts a que a URL pode levar: o hostname e, se houver, o `host=` da query
 * (estilo libpq/socket). Cada driver dá precedência a um deles, então o guard exige que
 * TODOS sejam locais. Retorna null se não der para extrair nenhum.
 */
export function extrairHosts(urlStr?: string): string[] | null {
  if (!urlStr || typeof urlStr !== 'string') {
    return null;
  }
  try {
    const parsed = new URL(urlStr);
    const hosts = [parsed.hostname, ...parsed.searchParams.getAll('host')]
      .map(normalizarHost)
      .filter((h) => h.length > 0);
    return hosts.length > 0 ? hosts : null;
  } catch {
    // Fallback para strings de conexão onde new URL possa falhar
    const match = urlStr.match(/@([^:/]+)/);
    return match && match[1] ? [match[1].toLowerCase()] : null;
  }
}

/** Host principal (hostname) da URL, normalizado; null se não der para extrair. */
export function extrairHost(urlStr?: string): string | null {
  return extrairHosts(urlStr)?.[0] ?? null;
}

const todosLocais = (hosts: string[] | null): boolean =>
  hosts !== null && hosts.every((h) => ALLOWED_TEST_HOSTS.has(h));

export function hostLocalAutorizado(valor?: string): boolean {
  return todosLocais(extrairHosts(valor));
}

export function validarAmbienteSeguroTestes(
  dbUrl?: string,
  esNode?: string,
  allowRemote = process.env.ALLOW_REMOTE_TEST_DATABASE === 'true',
  directUrl?: string,
): void {
  if (allowRemote) {
    return;
  }

  const dbHost = extrairHost(dbUrl);
  // Falha fechada: valor preenchido cujo host nao da para extrair tambem e bloqueado.
  if (dbUrl && !todosLocais(extrairHosts(dbUrl))) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: DATABASE_URL aponta para um host remoto/não reconhecido ('${dbHost ?? 'ilegível'}'). ` +
        `Para testes E2E e de integração, utilize serviços locais (ex.: docker compose com localhost:5432). ` +
        `Caso realmente deseje rodar testes contra este host remoto, defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }

  const directHost = extrairHost(directUrl);
  if (directUrl && !todosLocais(extrairHosts(directUrl))) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: DIRECT_URL aponta para um host remoto/não reconhecido ('${directHost ?? 'ilegível'}'). ` +
        `Use o banco local ou defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }

  const esHost = extrairHost(esNode);
  if (esNode && !todosLocais(extrairHosts(esNode))) {
    throw new Error(
      `[SEGURANÇA QA-07] Execução de testes abortada: ELASTICSEARCH_NODE aponta para um host remoto/não reconhecido ('${esHost ?? 'ilegível'}'). ` +
        `Para testes E2E e de integração, utilize serviços locais (ex.: docker compose com localhost:9200). ` +
        `Caso realmente deseje rodar testes contra este host remoto, defina explicitamente ALLOW_REMOTE_TEST_DATABASE=true.`,
    );
  }
}
