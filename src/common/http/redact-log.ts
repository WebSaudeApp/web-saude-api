import type { Request } from 'express';

/**
 * Formata a rota da requisição para logs seguros (LGPD - BE-31):
 * Registra o caminho sem query string e apenas a lista ordenada dos NOMES dos parâmetros,
 * nunca os valores (ex.: GET /estabelecimentos [especialidade,lat,lng,termo]).
 */
// Nome de parâmetro válido = identificador (letra ou _, depois letras, dígitos ou _; até 40).
// Não aceita dígitos, ponto ou hífen no início, para um "nome" como `-8.05389` (coordenada
// enviada sem `=`) não entrar no log como se fosse o nome do parâmetro.
const NOME_PARAMETRO_SEGURO = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const MAX_PARAMETROS_LOGADOS = 20;

export function sanitizarRotaLog(request: Request): string {
  const caminho =
    request.path ?? (request.url ? request.url.split('?')[0] : '/');
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
