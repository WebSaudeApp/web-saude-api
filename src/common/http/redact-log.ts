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
export function sanitizarRotaLog(request: Request): string {
  const caminho =
    request.path ?? (request.url ? request.url.split('?')[0] : '/');
  const nomesParametros = Object.keys(request.query ?? {}).sort();

  if (nomesParametros.length === 0) {
    return caminho;
  }

  return `${caminho} [${nomesParametros.join(',')}]`;
}
