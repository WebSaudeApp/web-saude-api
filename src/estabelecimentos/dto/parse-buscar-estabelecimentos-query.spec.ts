import { BadRequestException } from '@nestjs/common';
import { parseBuscarEstabelecimentosQuery } from './parse-buscar-estabelecimentos-query';

describe('parseBuscarEstabelecimentosQuery (Validações BE-09 / BE-12 / BE-14)', () => {
  it('aceita query geográfica completa e válida', () => {
    const query = parseBuscarEstabelecimentosQuery({
      lat: '-8.05389',
      lng: '-34.88111',
      raioKm: '15',
      pagina: '1',
      limite: '20',
    });

    expect(query.lat).toBe(-8.05389);
    expect(query.lng).toBe(-34.88111);
    expect(query.raioKm).toBe(15);
    expect(query.pagina).toBe(1);
    expect(query.limite).toBe(20);
  });

  it('aceita busca sem coordenadas geográficas (busca textual tradicional)', () => {
    const query = parseBuscarEstabelecimentosQuery({
      termo: 'hospital',
      cidade: 'Recife',
      estado: 'PE',
    });

    expect(query.termo).toBe('hospital');
    expect(query.cidade).toBe('Recife');
    expect(query.estado).toBe('PE');
    expect(query.lat).toBeUndefined();
    expect(query.lng).toBeUndefined();
  });

  it('rejeita envio de lat sem lng', () => {
    expect(() =>
      parseBuscarEstabelecimentosQuery({
        lat: '-8.05389',
      }),
    ).toThrow(BadRequestException);

    try {
      parseBuscarEstabelecimentosQuery({ lat: '-8.05389' });
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as {
        status: number;
        erros: Array<{ campo: string; mensagem: string }>;
      };
      expect(resp.status).toBe(400);
      expect(resp.erros.some((err) => err.campo === 'lng')).toBe(true);
    }
  });

  it('rejeita envio de lng sem lat', () => {
    try {
      parseBuscarEstabelecimentosQuery({ lng: '-34.88111' });
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as {
        status: number;
        erros: Array<{ campo: string; mensagem: string }>;
      };
      expect(resp.status).toBe(400);
      expect(resp.erros.some((err) => err.campo === 'lat')).toBe(true);
    }
  });

  it('rejeita envio de raioKm sem coordenadas lat/lng', () => {
    try {
      parseBuscarEstabelecimentosQuery({ raioKm: '25' });
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as {
        status: number;
        erros: Array<{ campo: string; mensagem: string }>;
      };
      expect(resp.status).toBe(400);
      expect(resp.erros.some((err) => err.campo === 'raioKm')).toBe(true);
    }
  });

  it('rejeita latitude fora dos limites (-90 a 90)', () => {
    try {
      parseBuscarEstabelecimentosQuery({
        lat: '95',
        lng: '-34.88',
      });
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as {
        status: number;
        erros: Array<{ campo: string; mensagem: string }>;
      };
      expect(resp.status).toBe(400);
      expect(resp.erros.some((err) => err.campo === 'lat')).toBe(true);
    }
  });

  it('rejeita longitude fora dos limites (-180 a 180)', () => {
    try {
      parseBuscarEstabelecimentosQuery({
        lat: '-8.05',
        lng: '185',
      });
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as {
        status: number;
        erros: Array<{ campo: string; mensagem: string }>;
      };
      expect(resp.status).toBe(400);
      expect(resp.erros.some((err) => err.campo === 'lng')).toBe(true);
    }
  });

  it('rejeita raioKm maior que 50 km', () => {
    try {
      parseBuscarEstabelecimentosQuery({
        lat: '-8.05',
        lng: '-34.88',
        raioKm: '55',
      });
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as {
        status: number;
        erros: Array<{ campo: string; mensagem: string }>;
      };
      expect(resp.status).toBe(400);
      expect(resp.erros.some((err) => err.campo === 'raioKm')).toBe(true);
    }
  });

  it('rejeita parâmetros não reconhecidos (whitelist)', () => {
    expect(() =>
      parseBuscarEstabelecimentosQuery({
        parametroDesconhecido: 'invalido',
      }),
    ).toThrow(BadRequestException);
  });
});
