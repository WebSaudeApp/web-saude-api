import { BuscarEstabelecimentosDto } from './buscar-estabelecimentos.dto';

export function validarRegrasGeograficas(
  query: Partial<BuscarEstabelecimentosDto>,
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
