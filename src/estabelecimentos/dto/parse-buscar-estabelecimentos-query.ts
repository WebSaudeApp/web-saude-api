import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BuscarEstabelecimentosDto } from './buscar-estabelecimentos.dto';

function validationErrors(
  errors: ReturnType<typeof validateSync>,
): Array<{ campo: string; mensagem: string }> {
  return errors.flatMap((error) => {
    const constraints = error.constraints
      ? Object.entries(error.constraints)
      : [];
    const unknownParameter = constraints.some(
      ([constraint]) => constraint === 'whitelistValidation',
    );
    const firstConstraint = constraints[0];
    const current = constraints.length
      ? [
          {
            campo: error.property,
            mensagem: unknownParameter
              ? 'Parâmetro não aceito.'
              : (firstConstraint?.[1] ?? 'Valor inválido.'),
          },
        ]
      : [];
    const children = validationErrors(error.children ?? []);
    return [...current, ...children];
  });
}

export function parseBuscarEstabelecimentosQuery(
  rawQuery: Record<string, unknown>,
): BuscarEstabelecimentosDto {
  const query = plainToInstance(BuscarEstabelecimentosDto, rawQuery);
  const errors = validateSync(query, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    throw new BadRequestException({
      status: 400,
      mensagem: 'Parâmetros inválidos.',
      erros: validationErrors(errors),
    });
  }
  return query;
}
