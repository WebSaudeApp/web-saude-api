import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EnderecoDto, UpdateEnderecoDto } from './endereco.dto';

describe('EnderecoDto (Validações de Coordenadas no Brasil - BE-07 / QA-06)', () => {
  const dadosValidos = {
    cep: '50070-000',
    logradouro: 'Av. Governador Agamenon Magalhães',
    numero: '4760',
    bairro: 'Paissandu',
    cidade: 'Recife',
    estado: 'PE',
    latitude: -8.0476,
    longitude: -34.877,
  };

  it('aceita coordenadas válidas dentro do Brasil (Recife)', async () => {
    const dto = plainToInstance(EnderecoDto, dadosValidos);
    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });

  describe('Limites exatos de Latitude (-34 a 6)', () => {
    it('aceita latitude na borda inferior exata (-34)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: -34,
      });
      const erros = await validate(dto);
      expect(erros.find((e) => e.property === 'latitude')).toBeUndefined();
    });

    it('recusa latitude imediatamente abaixo da borda inferior (-34.0001)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: -34.0001,
      });
      const erros = await validate(dto);
      const erroLat = erros.find((e) => e.property === 'latitude');
      expect(erroLat).toBeDefined();
      expect(erroLat?.constraints?.min).toBe(
        'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
      );
    });

    it('aceita latitude na borda superior exata (6)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: 6,
      });
      const erros = await validate(dto);
      expect(erros.find((e) => e.property === 'latitude')).toBeUndefined();
    });

    it('recusa latitude imediatamente acima da borda superior (6.0001)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: 6.0001,
      });
      const erros = await validate(dto);
      const erroLat = erros.find((e) => e.property === 'latitude');
      expect(erroLat).toBeDefined();
      expect(erroLat?.constraints?.max).toBe(
        'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
      );
    });
  });

  describe('Limites exatos de Longitude (-74 a -28)', () => {
    it('aceita longitude na borda oeste exata (-74)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -74,
      });
      const erros = await validate(dto);
      expect(erros.find((e) => e.property === 'longitude')).toBeUndefined();
    });

    it('recusa longitude imediatamente a oeste da borda (-74.0001)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -74.0001,
      });
      const erros = await validate(dto);
      const erroLon = erros.find((e) => e.property === 'longitude');
      expect(erroLon).toBeDefined();
      expect(erroLon?.constraints?.min).toBe(
        'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
      );
    });

    it('aceita longitude na borda leste exata (-28)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -28,
      });
      const erros = await validate(dto);
      expect(erros.find((e) => e.property === 'longitude')).toBeUndefined();
    });

    it('recusa longitude imediatamente a leste da borda (-27.9999)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -27.9999,
      });
      const erros = await validate(dto);
      const erroLon = erros.find((e) => e.property === 'longitude');
      expect(erroLon).toBeDefined();
      expect(erroLon?.constraints?.max).toBe(
        'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
      );
    });

    it('recusa coordenadas (0, 0) / Null Island isolando a longitude', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: -8.0476,
        longitude: 0,
      });
      const erros = await validate(dto);
      const erroLon = erros.find((e) => e.property === 'longitude');
      expect(erroLon).toBeDefined();
    });
  });

  describe('UpdateEnderecoDto (edição parcial com isolamento de campos)', () => {
    it('permite atualizar somente coordenadas válidas', async () => {
      const dto = plainToInstance(UpdateEnderecoDto, {
        latitude: -23.5505, // São Paulo
        longitude: -46.6333,
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('recusa somente latitude fora do Brasil mantendo longitude ausente', async () => {
      const dto = plainToInstance(UpdateEnderecoDto, {
        latitude: 48.8566, // Paris (hemisfério norte fora do Brasil)
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(1);
      expect(erros[0].property).toBe('latitude');
      expect(erros[0].constraints?.max).toBe(
        'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
      );
    });

    it('recusa somente longitude fora do Brasil mantendo latitude ausente', async () => {
      const dto = plainToInstance(UpdateEnderecoDto, {
        longitude: 2.3522, // Paris (leste fora do Brasil)
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(1);
      expect(erros[0].property).toBe('longitude');
      expect(erros[0].constraints?.max).toBe(
        'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
      );
    });
  });
});
