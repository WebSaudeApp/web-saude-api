/**
 * Decide se um erro vindo do Elasticsearch significa "o ES está indisponível" (conexão
 * recusada/resetada, timeout, sem nó vivo, HTTP 5xx). Só nesses casos a busca por
 * localização pode cair no PostgreSQL. Erros 4xx (ex.: parsing_exception, ou seja, bug na
 * query) e erros nossos (TypeError etc.) NÃO são indisponibilidade e devem ser relançados.
 */
const NOMES_INDISPONIBILIDADE = new Set([
  'ConnectionError',
  'TimeoutError',
  'NoLivingConnectionsError',
]);

const CODIGOS_REDE = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
]);

export function elasticsearchIndisponivel(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) {
    return false;
  }
  const e = erro as {
    name?: string;
    code?: string;
    statusCode?: number;
    meta?: { statusCode?: number };
  };
  if (e.name && NOMES_INDISPONIBILIDADE.has(e.name)) {
    return true;
  }
  if (e.code && CODIGOS_REDE.has(e.code)) {
    return true;
  }
  const status = e.statusCode ?? e.meta?.statusCode;
  return typeof status === 'number' && status >= 500;
}
