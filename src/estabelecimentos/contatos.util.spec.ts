import { BadRequestException } from '@nestjs/common';
import { TipoContato } from '@prisma/client';
import { normalizeContatos } from './contatos.util';

describe('normalizeContatos', () => {
  it('remove espaços, normaliza e-mail e descarta duplicados', () => {
    expect(
      normalizeContatos([
        { tipo: TipoContato.EMAIL, valor: ' Contato@Hospital.com ' },
        { tipo: TipoContato.EMAIL, valor: 'contato@hospital.com' },
        { tipo: TipoContato.TELEFONE, valor: ' 8133334444 ' },
      ]),
    ).toEqual([
      { tipo: TipoContato.EMAIL, valor: 'contato@hospital.com' },
      { tipo: TipoContato.TELEFONE, valor: '8133334444' },
    ]);
  });

  it('rejeita valor incompatível com o tipo', () => {
    expect(() =>
      normalizeContatos([{ tipo: TipoContato.EMAIL, valor: 'sem-arroba' }]),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeContatos([{ tipo: TipoContato.SITE, valor: 'nao-e-url' }]),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeContatos([
        { tipo: TipoContato.WHATSAPP, valor: '1'.repeat(21) },
      ]),
    ).toThrow(BadRequestException);
  });
});
