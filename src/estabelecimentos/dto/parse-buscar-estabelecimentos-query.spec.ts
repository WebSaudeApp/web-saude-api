import { validarRegrasGeograficas } from './parse-buscar-estabelecimentos-query';

describe('validarRegrasGeograficas (Regras geográficas BE-09 / BE-12 / BE-14)', () => {
  it('aceita query geográfica completa e válida', () => {
    const erros = validarRegrasGeograficas({
      lat: -8.05389,
      lng: -34.88111,
      raioKm: 15,
      pagina: 1,
      limite: 20,
    });

    expect(erros).toHaveLength(0);
  });

  it('aceita busca sem coordenadas geográficas (busca textual tradicional)', () => {
    const erros = validarRegrasGeograficas({
      termo: 'hospital',
      cidade: 'Recife',
      estado: 'PE',
    });

    expect(erros).toHaveLength(0);
  });

  it('rejeita envio de lat sem lng', () => {
    const erros = validarRegrasGeograficas({
      lat: -8.05389,
    });

    expect(erros).toEqual([
      {
        campo: 'lng',
        mensagem: 'Latitude e longitude devem ser enviadas juntas.',
      },
    ]);
  });

  it('rejeita envio de lng sem lat', () => {
    const erros = validarRegrasGeograficas({
      lng: -34.88111,
    });

    expect(erros).toEqual([
      {
        campo: 'lat',
        mensagem: 'Latitude e longitude devem ser enviadas juntas.',
      },
    ]);
  });

  it('rejeita envio de raioKm sem coordenadas lat/lng', () => {
    const erros = validarRegrasGeograficas({
      raioKm: 25,
    });

    expect(erros).toEqual([
      {
        campo: 'raioKm',
        mensagem:
          'O raio em km só pode ser informado junto com a latitude e a longitude.',
      },
    ]);
  });

  it('aceita consulta apenas com coordenadas sem raioKm (raio default assumido pelo serviço)', () => {
    const erros = validarRegrasGeograficas({
      lat: -8.05389,
      lng: -34.88111,
    });

    expect(erros).toHaveLength(0);
  });
});
