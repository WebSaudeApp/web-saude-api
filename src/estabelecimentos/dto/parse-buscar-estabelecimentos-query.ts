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

export function validarRegrasGeograficas(
  query: BuscarEstabelecimentosDto,
): Array<{ campo: string; mensagem: string }> {
  const erros: Array<{ campo: string; mensagem: string }> = [];

  const temLat = query.lat !== undefined && query.lat !== null;
  const temLng = query.lng !== undefined && query.lng !== null;
  const temRaio = query.raioKm !== undefined && query.raioKm !== null;

  if (temLat && !temLng) {
    erros.push({
      campo: 'lng',
      mensagem: 'Latitude e longitude devem ser enviadas juntas.',
    });
  } else if (!temLat && temLng) {
    erros.push({
      campo: 'lat',
      mensagem: 'Latitude e longitude devem ser enviadas juntas.',
    });
  }

  if (temRaio && (!temLat || !temLng)) {
    erros.push({
      campo: 'raioKm',
      mensagem:
        'O raio em km só pode ser informado junto com a latitude e a longitude.',
    });
  }

  return erros;
}

export function parseBuscarEstabelecimentosQuery(
  rawQuery: Record<string, unknown>,
): BuscarEstabelecimentosDto {
  const query = plainToInstance(BuscarEstabelecimentosDto, rawQuery);
  const errors = validateSync(query, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const todosErros = validationErrors(errors);
  const errosGeograficos = validarRegrasGeograficas(query);
  todosErros.push(...errosGeograficos);

  if (todosErros.length > 0) {
    throw new BadRequestException({
      status: 400,
      mensagem: 'Parâmetros inválidos.',
      erros: todosErros,
    });
  }
  return query;
}
