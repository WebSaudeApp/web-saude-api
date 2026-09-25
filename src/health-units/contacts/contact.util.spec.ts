import { BadRequestException } from '@nestjs/common';
import { ContactType } from '@prisma/client';
import { normalizeContacts } from './contact.util';

describe('normalizeContacts', () => {
  it('remove espaços, normaliza e-mail e descarta duplicados', () => {
    expect(
      normalizeContacts([
        { type: ContactType.EMAIL, value: ' Contato@Hospital.com ' },
        { type: ContactType.EMAIL, value: 'contato@hospital.com' },
        { type: ContactType.TELEFONE, value: ' 8133334444 ' },
      ]),
    ).toEqual([
      { type: ContactType.EMAIL, value: 'contato@hospital.com' },
      { type: ContactType.TELEFONE, value: '8133334444' },
    ]);
  });

  it('rejeita valor incompatível com o tipo', () => {
    expect(() =>
      normalizeContacts([{ type: ContactType.EMAIL, value: 'sem-arroba' }]),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeContacts([{ type: ContactType.SITE, value: 'nao-e-url' }]),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeContacts([
        { type: ContactType.TELEFONE, value: '1'.repeat(21) },
      ]),
    ).toThrow(BadRequestException);
  });
});
