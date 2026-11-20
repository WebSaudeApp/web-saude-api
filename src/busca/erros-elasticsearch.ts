import { errors } from '@elastic/elasticsearch';

/**
 * Decide se um erro vindo do Elasticsearch significa "o ES não consegue atender agora"
 * (conexão/timeout/sem nó vivo, HTTP 5xx, 429 por sobrecarga, ou índice/alias ainda inexistente
 * antes do `es:init`). Só nesses casos a busca por localização cai no PostgreSQL.
 * Erros 400 (ex.: parsing_exception, bug de query) e erros nossos (TypeError etc.) NÃO são
 * indisponibilidade e devem ser relançados.
 */
const CODIGOS_REDE = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
]);

export function elasticsearchIndisponivel(erro: unknown): boolean {
  if (
    erro instanceof errors.ConnectionError ||
    erro instanceof errors.TimeoutError ||
    erro instanceof errors.NoLivingConnectionsError
  ) {
    return true;
  }

  if (erro instanceof errors.ResponseError) {
    const status = erro.statusCode ?? 0;
    if (status >= 500 || status === 429) {
      return true;
    }
    const body = erro.body as { error?: { type?: string } } | undefined;
    return status === 404 && body?.error?.type === 'index_not_found_exception';
  }

  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' && CODIGOS_REDE.has(codigo);
}
