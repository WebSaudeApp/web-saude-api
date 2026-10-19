import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { BuscaService } from '../src/busca/busca.service';
import { DocumentoEstabelecimento } from '../src/busca/documento-estabelecimento';

describe('Busca (e2e / Integração Elasticsearch)', () => {
  let app: INestApplication;
  let buscaService: BuscaService;

  const docEsperanca: DocumentoEstabelecimento = {
    id: 'teste-es-recife-1',
    nome: 'Hospital Esperança Recife',
    tipo: { id: 'tipo-hosp', nome: 'HOSPITAL' },
    endereco: {
      cep: '50070-000',
      logradouro: 'Rua do Espinheiro',
      numero: '100',
      bairro: 'Ilha do Leite',
      cidade: 'Recife',
      estado: 'PE',
    },
    localizacao: { lat: -8.0641, lon: -34.8967 },
    especialidades: [{ id: 'esp-cardio', nome: 'Cardiologia' }],
    horarios: [
      {
        diaSemana: 'SEGUNDA',
        horaAbertura: '00:00',
        horaFechamento: '23:59',
        atende24h: true,
      },
    ],
    notaMedia: 4.8,
    totalReviews: 50,
  };

  const docClinica: DocumentoEstabelecimento = {
    id: 'teste-es-recife-2',
    nome: 'Clínica de Saúde Boa Viagem',
    tipo: { id: 'tipo-clin', nome: 'CLINICA' },
    endereco: {
      cep: '51020-000',
      logradouro: 'Avenida Boa Viagem',
      numero: '500',
      bairro: 'Boa Viagem',
      cidade: 'Recife',
      estado: 'PE',
    },
    localizacao: { lat: -8.1258, lon: -34.903 },
    especialidades: [{ id: 'esp-dermato', nome: 'Dermatologia' }],
    horarios: [
      {
        diaSemana: 'SEGUNDA',
        horaAbertura: '08:00',
        horaFechamento: '18:00',
        atende24h: false,
      },
    ],
    notaMedia: 4.6,
    totalReviews: 30,
  };

  const docCaruaru: DocumentoEstabelecimento = {
    id: 'teste-es-caruaru-1',
    nome: 'Hospital Regional do Agreste',
    tipo: { id: 'tipo-hosp', nome: 'HOSPITAL' },
    endereco: {
      cep: '55000-000',
      logradouro: 'Rodovia BR-232',
      numero: 'KM 130',
      bairro: 'Universitário',
      cidade: 'Caruaru',
      estado: 'PE',
    },
    localizacao: { lat: -8.2833, lon: -35.9761 }, // ~120 km do Marco Zero de Recife
    especialidades: [{ id: 'esp-orto', nome: 'Ortopedia' }],
    notaMedia: 4.2,
    totalReviews: 15,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
        isDatabaseConnected: jest.fn().mockResolvedValue(true),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    buscaService = app.get(BuscaService);

    // Garante que o índice e o alias estão inicializados no Elasticsearch
    await buscaService.inicializarIndice();

    // Indexa os 3 documentos de teste
    await buscaService.indexarEstabelecimento(docEsperanca);
    await buscaService.indexarEstabelecimento(docClinica);
    await buscaService.indexarEstabelecimento(docCaruaru);

    // Dá refresh no índice para disponibilidade imediata das consultas
    const cliente = buscaService.obterCliente();
    await cliente.indices.refresh({ index: 'estabelecimentos' });
  }, 30000);

  afterAll(async () => {
    // Limpeza dos documentos de teste
    if (buscaService) {
      await buscaService.removerEstabelecimento(docEsperanca.id);
      await buscaService.removerEstabelecimento(docClinica.id);
      await buscaService.removerEstabelecimento(docCaruaru.id);
    }
    if (app) {
      await app.close();
    }
  });

  it('Critério 1: recupera um estabelecimento indexado diretamente pelo id', async () => {
    const doc = await buscaService.obterEstabelecimentoPorId(docEsperanca.id);

    expect(doc).not.toBeNull();
    expect(doc?.id).toBe(docEsperanca.id);
    expect(doc?.nome).toBe(docEsperanca.nome);
    expect(doc?.localizacao).toEqual(docEsperanca.localizacao);
  });

  it('Critério 2: busca textual com termo sem acento encontra o estabelecimento correto', async () => {
    // Busca por "clinica" (sem acento) deve encontrar "Clínica de Saúde Boa Viagem"
    const resultadoClinica = await buscaService.buscarEstabelecimentos({
      termo: 'clinica',
      limite: 100,
    });

    const nomesClinica = resultadoClinica.itens.map(
      (item) => item.estabelecimento.nome,
    );
    expect(nomesClinica).toContain('Clínica de Saúde Boa Viagem');

    // Busca por "saude" (sem acento) deve encontrar a clínica
    const resultadoSaude = await buscaService.buscarEstabelecimentos({
      termo: 'saude',
      limite: 100,
    });
    const nomesSaude = resultadoSaude.itens.map(
      (item) => item.estabelecimento.nome,
    );
    expect(nomesSaude).toContain('Clínica de Saúde Boa Viagem');

    // Busca por "esperanca" (sem cedilha e sem acento) deve encontrar "Hospital Esperança Recife"
    const resultadoEsperanca = await buscaService.buscarEstabelecimentos({
      termo: 'esperanca',
    });
    const nomesEsperanca = resultadoEsperanca.itens.map(
      (item) => item.estabelecimento.nome,
    );
    expect(nomesEsperanca).toContain('Hospital Esperança Recife');
  });

  it('Critério 3: consulta geo_distance devolve apenas estabelecimentos dentro do raio e exclui os de fora', async () => {
    // Coordenadas do Marco Zero de Recife (lat: -8.0631, lon: -34.8711)
    // Esperança fica a ~2.8 km, Boa Viagem a ~7.8 km, Caruaru a ~120 km
    const resultadoRaio10Km = await buscaService.buscarEstabelecimentos({
      localizacao: {
        lat: -8.0631,
        lon: -34.8711,
        raioKm: 10,
      },
    });

    const idsRetornados = resultadoRaio10Km.itens.map(
      (item) => item.estabelecimento.id,
    );

    // Devem estar dentro do raio de 10 km:
    expect(idsRetornados).toContain(docEsperanca.id);
    expect(idsRetornados).toContain(docClinica.id);

    // NÃO deve estar dentro do raio de 10 km (Caruaru fica a ~120 km):
    expect(idsRetornados).not.toContain(docCaruaru.id);

    // Valida que a distância calculada está presente e ordenada
    const distancias = resultadoRaio10Km.itens.map(
      (item) => item.distanciaKm ?? 0,
    );
    expect(distancias[0]).toBeLessThanOrEqual(distancias[1]);
  });

  it('Critério 3 (raio reduzido): consulta com raio de 5 km devolve apenas o hospital mais próximo', async () => {
    // Marco Zero de Recife com raio de 5 km:
    // Hospital Esperança (~2.8 km) entra; Clínica Boa Viagem (~7.8 km) e Caruaru (~120 km) saem.
    const resultadoRaio5Km = await buscaService.buscarEstabelecimentos({
      localizacao: {
        lat: -8.0631,
        lon: -34.8711,
        raioKm: 5,
      },
    });

    const idsRetornados = resultadoRaio5Km.itens.map(
      (item) => item.estabelecimento.id,
    );

    expect(idsRetornados).toContain(docEsperanca.id);
    expect(idsRetornados).not.toContain(docClinica.id);
    expect(idsRetornados).not.toContain(docCaruaru.id);

    // A distância deve ser de aproximadamente 2.82 km
    const itemEsperanca = resultadoRaio5Km.itens.find(
      (i) => i.estabelecimento.id === docEsperanca.id,
    );
    expect(itemEsperanca?.distanciaKm).toBeCloseTo(2.82, 1);
  });

  describe('Filtros Combinados com Raio Geográfico (BE-11)', () => {
    it('filtra por tipo combinado ao raio geográfico', async () => {
      // No raio de 10 km há o Hospital Esperança e a Clínica Boa Viagem.
      // Filtrando por tipo "HOSPITAL", a Clínica Boa Viagem deve ser excluída.
      const busca = await buscaService.buscarEstabelecimentos({
        tipo: 'HOSPITAL',
        localizacao: {
          lat: -8.0631,
          lon: -34.8711,
          raioKm: 10,
        },
      });

      const ids = busca.itens.map((i) => i.estabelecimento.id);
      expect(ids).toContain(docEsperanca.id);
      expect(ids).not.toContain(docClinica.id);
      expect(ids).not.toContain(docCaruaru.id);
    });

    it('filtra por especialidade combinada ao raio geográfico', async () => {
      // No raio de 10 km, apenas a Clínica Boa Viagem possui a especialidade "Dermatologia".
      const busca = await buscaService.buscarEstabelecimentos({
        especialidade: 'Dermatologia',
        localizacao: {
          lat: -8.0631,
          lon: -34.8711,
          raioKm: 10,
        },
      });

      const ids = busca.itens.map((i) => i.estabelecimento.id);
      expect(ids).toContain(docClinica.id);
      expect(ids).not.toContain(docEsperanca.id);
    });

    it('retorna lista vazia sem erro quando o tipo não existe no raio (RN05)', async () => {
      const busca = await buscaService.buscarEstabelecimentos({
        tipo: 'LABORATORIO',
        localizacao: {
          lat: -8.0631,
          lon: -34.8711,
          raioKm: 10,
        },
      });

      expect(busca.itens).toEqual([]);
      expect(busca.total).toBe(0);
    });

    it('retorna lista vazia sem erro quando a especialidade não existe no raio (RN06)', async () => {
      const busca = await buscaService.buscarEstabelecimentos({
        especialidade: 'Neurocirurgia Espacial',
        localizacao: {
          lat: -8.0631,
          lon: -34.8711,
          raioKm: 10,
        },
      });

      expect(busca.itens).toEqual([]);
      expect(busca.total).toBe(0);
    });
  });

  describe('Sincronização com o Banco de Dados (BE-15)', () => {
    it('cadastra/atualiza estabelecimento no índice e reflete nas buscas', async () => {
      const docNovo: DocumentoEstabelecimento = {
        id: 'teste-sinc-1',
        nome: 'Posto de Saúde Santo Amaro',
        tipo: { id: 'tipo-posto', nome: 'POSTO' },
        endereco: {
          cep: '50100-000',
          logradouro: 'Rua do Pombal',
          numero: '30',
          cidade: 'Recife',
          estado: 'PE',
        },
        localizacao: { lat: -8.0505, lon: -34.8825 },
        especialidades: [{ id: 'esp-clin', nome: 'Clínica Geral' }],
      };

      await buscaService.indexarEstabelecimento(docNovo);
      await buscaService
        .obterCliente()
        .indices.refresh({ index: 'estabelecimentos' });

      const busca = await buscaService.buscarEstabelecimentos({
        termo: 'Santo Amaro',
      });
      const ids = busca.itens.map((i) => i.estabelecimento.id);
      expect(ids).toContain(docNovo.id);

      // Edição de dados (nome e especialidade)
      const docAtualizado = {
        ...docNovo,
        nome: 'Centro de Saúde Especializado Santo Amaro',
        especialidades: [
          { id: 'esp-clin', nome: 'Clínica Geral' },
          { id: 'esp-ped', nome: 'Pediatria' },
        ],
      };
      await buscaService.indexarEstabelecimento(docAtualizado);
      await buscaService
        .obterCliente()
        .indices.refresh({ index: 'estabelecimentos' });

      const buscaEditado = await buscaService.buscarEstabelecimentos({
        termo: 'Pediatria',
      });
      const idsEditado = buscaEditado.itens.map((i) => i.estabelecimento.id);
      expect(idsEditado).toContain(docNovo.id);

      // Exclusão do estabelecimento: deve sumir da busca
      await buscaService.removerEstabelecimento(docNovo.id);
      await buscaService
        .obterCliente()
        .indices.refresh({ index: 'estabelecimentos' });

      const docExcluido = await buscaService.obterEstabelecimentoPorId(
        docNovo.id,
      );
      expect(docExcluido).toBeNull();
    });
  });
});
