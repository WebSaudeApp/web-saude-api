import type { Request } from 'express';

// Só identificador (letra ou _, depois letras, dígitos ou _; até 40): um "nome" como `-8.05389`
// (coordenada enviada sem `=`) não entra no log. Nome com colchete ou hífen (ex.: ids[]) aparece
// como ?x1 até ajustarem esta regex.
const NOME_PARAMETRO_SEGURO = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const MAX_PARAMETROS_LOGADOS = 20;

/**
 * Formata a rota da requisição para logs seguros (BE-31):
 * registra o MOLDE da rota (ex.: `/estabelecimentos/:id`, nunca o valor do `:id`) e apenas a
 * lista ordenada dos NOMES dos parâmetros da query, nunca os valores
 * (ex.: GET /estabelecimentos [especialidade,lat,lng,termo]).
 */
export function sanitizarRotaLog(request: Request): string {
  const caminho = caminhoSemValores(request);
  // Nomes vêm do cliente: só entram no log se forem identificadores curtos; os demais
  // (valores sem `=`, quebras de linha para forjar log etc.) viram um único marcador
  // com a contagem (ex.: `?x7`). Acima de 20 nomes válidos, o restante é descartado.
  const todos = Object.keys(request.query ?? {});
  const validos = todos.filter((nome) => NOME_PARAMETRO_SEGURO.test(nome));
  const invalidos = todos.length - validos.length;
  const nomesParametros = validos.sort().slice(0, MAX_PARAMETROS_LOGADOS);
  if (invalidos > 0) {
    nomesParametros.push(`?x${invalidos}`);
  }

  if (nomesParametros.length === 0) {
    return caminho;
  }

  return `${caminho} [${nomesParametros.join(',')}]`;
}

/**
 * Com rota casada, usa o molde declarado no controller (`/estabelecimentos/:id`), para um
 * valor posto no caminho (ex.: `/estabelecimentos/-8.05,-34.88`) não ir para o log.
 * Sem rota casada (404 antes do controller), usa o caminho sem query string.
 */
function caminhoSemValores(request: Request): string {
  const molde = (request.route as { path?: unknown } | undefined)?.path;
  if (typeof molde === 'string') {
    return `${request.baseUrl ?? ''}${molde}`;
  }
  return request.path ?? (request.url ? request.url.split('?')[0] : '/');
}
