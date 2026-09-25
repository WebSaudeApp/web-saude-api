import { BadRequestException } from '@nestjs/common';
import { ContactType } from '@prisma/client';

export interface ContactInput {
  type: ContactType;
  value: string;
}

const PHONE_MAX_LENGTH = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertValid({ type, value }: ContactInput): void {
  const valid =
    type === ContactType.EMAIL
      ? EMAIL_PATTERN.test(value)
      : type === ContactType.SITE
        ? isValidUrl(value)
        : value.length <= PHONE_MAX_LENGTH;
  if (!valid) {
    throw new BadRequestException(`Contato inválido para o tipo ${type}.`);
  }
}

export function normalizeContacts(items: ContactInput[]): ContactInput[] {
  const seen = new Set<string>();
  const result: ContactInput[] = [];
  for (const item of items) {
    const value =
      item.type === ContactType.EMAIL
        ? item.value.trim().toLowerCase()
        : item.value.trim();
    const contact = { type: item.type, value };
    assertValid(contact);
    const key = `${contact.type}:${contact.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(contact);
    }
  }
  return result;
}
