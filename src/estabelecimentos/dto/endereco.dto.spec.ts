import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EnderecoDto, UpdateEnderecoDto } from './endereco.dto';

describe('EnderecoDto (Validação de Coordenadas no Brasil - BE-07)', () => {
  const dadosValidos = {
    cep: '50070000',
    logradouro: 'Rua do Espinheiro',
    numero: '100',
    bairro: 'Espinheiro',
    cidade: 'Recife',
    estado: 'PE',
    latitude: -8.0476,
    longitude: -34.877,
  };

  it('valida com sucesso um endereço com coordenadas dentro do Brasil', async () => {
    const dto = plainToInstance(EnderecoDto, dadosValidos);
    const erros = await validate(dto);

    expect(erros).toHaveLength(0);
  });

  describe('Latitude (território brasileiro: entre -34 e 6)', () => {
    it('aceita latitude no extremo norte (+5.27)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: 5.27,
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('aceita latitude no extremo sul (-33.75)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: -33.75,
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('recusa latitude menor que -34 (ao sul do Brasil)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: -35.0,
      });
      const erros = await validate(dto);

      expect(erros.length).toBeGreaterThan(0);
      const erroLat = erros.find((e) => e.property === 'latitude');
      expect(erroLat).toBeDefined();
      expect(erroLat?.constraints?.min).toBe(
        'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
      );
    });

    it('recusa latitude maior que 6 (ao norte do Brasil, ex: Hemisfério Norte/EUA)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: 40.7128, // Nova York
      });
      const erros = await validate(dto);

      expect(erros.length).toBeGreaterThan(0);
      const erroLat = erros.find((e) => e.property === 'latitude');
      expect(erroLat).toBeDefined();
      expect(erroLat?.constraints?.max).toBe(
        'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
      );
    });
  });

  describe('Longitude (território brasileiro: entre -74 e -28)', () => {
    it('aceita longitude no extremo oeste (-73.98)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -73.98,
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('aceita longitude no extremo leste / ilhas (-29.35)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -29.35,
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('recusa longitude menor que -74 (ao oeste do Brasil)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -75.0,
      });
      const erros = await validate(dto);

      expect(erros.length).toBeGreaterThan(0);
      const erroLon = erros.find((e) => e.property === 'longitude');
      expect(erroLon).toBeDefined();
      expect(erroLon?.constraints?.min).toBe(
        'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
      );
    });

    it('recusa longitude maior que -28 (ao leste do Brasil / Oceano / Europa)', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        longitude: -20.0,
      });
      const erros = await validate(dto);

      expect(erros.length).toBeGreaterThan(0);
      const erroLon = erros.find((e) => e.property === 'longitude');
      expect(erroLon).toBeDefined();
      expect(erroLon?.constraints?.max).toBe(
        'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
      );
    });

    it('recusa coordenadas (0, 0) / Null Island', async () => {
      const dto = plainToInstance(EnderecoDto, {
        ...dadosValidos,
        latitude: 0,
        longitude: 0,
      });
      const erros = await validate(dto);

      expect(erros.length).toBeGreaterThan(0);
      const erroLon = erros.find((e) => e.property === 'longitude');
      expect(erroLon).toBeDefined();
    });
  });

  describe('UpdateEnderecoDto (edição parcial)', () => {
    it('permite atualizar somente coordenadas válidas', async () => {
      const dto = plainToInstance(UpdateEnderecoDto, {
        latitude: -23.5505, // São Paulo
        longitude: -46.6333,
      });
      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('recusa coordenadas fora do Brasil na edição parcial', async () => {
      const dto = plainToInstance(UpdateEnderecoDto, {
        latitude: 48.8566, // Paris
        longitude: 2.3522,
      });
      const erros = await validate(dto);
      expect(erros.length).toBeGreaterThan(0);
    });
  });
});
