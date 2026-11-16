import type { Request } from 'express';

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|code|hash/i;

export function redactLogValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return '[redacted]';
  }
  return value;
}

export function redactLogRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    safe[key] = redactLogValue(key, value);
  }
  return safe;
}

/**
 * Formata a rota da requisição para logs seguros (LGPD - BE-31):
 * Registra o caminho sem query string e apenas a lista ordenada dos NOMES dos parâmetros,
 * nunca os valores (ex.: GET /estabelecimentos [especialidade,lat,lng,termo]).
 */
const NOME_PARAMETRO_SEGURO = /^[\w.[\]-]{1,40}$/;
const MAX_PARAMETROS_LOGADOS = 20;

export function sanitizarRotaLog(request: Request): string {
  const caminho =
    request.path ?? (request.url ? request.url.split('?')[0] : '/');
  // Nomes vêm do cliente: só entram no log se forem curtos e sem caracteres de controle
  // (evita forjar linhas de log com quebra de linha); os demais viram um marcador.
  const nomesParametros = Object.keys(request.query ?? {})
    .map((nome) => (NOME_PARAMETRO_SEGURO.test(nome) ? nome : '?'))
    .sort()
    .slice(0, MAX_PARAMETROS_LOGADOS);

  if (nomesParametros.length === 0) {
    return caminho;
  }

  return `${caminho} [${nomesParametros.join(',')}]`;
}
