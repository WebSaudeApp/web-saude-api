import { BadRequestException } from '@nestjs/common';
import { TipoContato } from '@prisma/client';

export interface ContatoInput {
  tipo: TipoContato;
  valor: string;
}

const TELEFONE_MAX_LENGTH = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValid({ tipo, valor }: ContatoInput): boolean {
  if (tipo === TipoContato.EMAIL) return EMAIL_PATTERN.test(valor);
  if (tipo === TipoContato.SITE) return isValidUrl(valor);
  return valor.length <= TELEFONE_MAX_LENGTH;
}

export function normalizeContatos(items: ContatoInput[]): ContatoInput[] {
  const seen = new Set<string>();
  const result: ContatoInput[] = [];
  for (const item of items) {
    const valor =
      item.tipo === TipoContato.EMAIL
        ? item.valor.trim().toLowerCase()
        : item.valor.trim();
    const contato = { tipo: item.tipo, valor };
    if (!isValid(contato)) {
      throw new BadRequestException(
        `Contato inválido para o tipo ${item.tipo}.`,
      );
    }
    const key = `${contato.tipo}:${contato.valor}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(contato);
    }
  }
  return result;
}
