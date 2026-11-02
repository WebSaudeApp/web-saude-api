import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { BuscaService } from '../src/busca/busca.service';
import { EstabelecimentosService } from '../src/estabelecimentos/estabelecimentos.service';
import { mapearEstabelecimentoParaDocumento } from '../src/busca/documento-estabelecimento';

jest.setTimeout(120000);

describe('Paridade de Busca: PostgreSQL vs Elasticsearch (BE-30 #52)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let buscaService: BuscaService;
  let estabelecimentosService: EstabelecimentosService;
  let esDisponivel = false;

  const prefixo = `paridade-${Date.now()}`;
  let tipoHospitalId: string;
  const estabelecimentoIds: string[] = [];
  const enderecoIds: string[] = [];

  // Ponto central de referência do teste: Recife (-8.05, -34.88)
  const centroLat = -8.05;
  const centroLng = -34.88;

  let idE1: string;
  let idE2: string;
  let idE3: string;
  let idE4: string;
  let idE5: string;

  const filtrarIdsDoTeste = (itens: Array<{ id: string }>) =>
    itens.map((d) => d.id).filter((id) => estabelecimentoIds.includes(id));

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    buscaService = app.get(BuscaService);
    estabelecimentosService = app.get(EstabelecimentosService);

    // Garante tipos
    const tipoHosp = await prisma.tipoEstabelecimento.upsert({
      where: { nome: 'HOSPITAL' },
      update: {},
      create: { nome: 'HOSPITAL' },
    });
    tipoHospitalId = tipoHosp.id;

    // Garante especialidades com nomes exatos
    const esp1 = await prisma.especialidade.upsert({
      where: { nome: 'Clínica' },
      update: {},
      create: { nome: 'Clínica' },
    });

    const esp2 = await prisma.especialidade.upsert({
      where: { nome: 'Clínica Geral' },
      update: {},
      create: { nome: 'Clínica Geral' },
    });

    const esp3 = await prisma.especialidade.upsert({
      where: { nome: 'Clínica Médica' },
      update: {},
      create: { nome: 'Clínica Médica' },
    });

    // Cria os 5 estabelecimentos no raio de ~1 km
    // e1: "Hospital Central", Rua das Flores, cidade "São José", sem especialidade
    const end1 = await prisma.endereco.create({
      data: {
        cep: '50000-001',
        logradouro: 'Rua das Flores',
        numero: '10',
        bairro: 'Centro',
        cidade: 'São José',
        estado: 'PE',
        latitude: -8.0505,
        longitude: -34.8805,
      },
    });
    enderecoIds.push(end1.id);
    const e1 = await prisma.estabelecimento.create({
      data: {
        nome: `${prefixo} Hospital Central`,
        tipoId: tipoHospitalId,
        enderecoId: end1.id,
      },
    });
    idE1 = e1.id;
    estabelecimentoIds.push(idE1);

    // e2: "Policlínica do Sertão", Avenida Brasil, "São José do Egito", sem especialidade
    const end2 = await prisma.endereco.create({
      data: {
        cep: '50000-002',
        logradouro: 'Avenida Brasil',
        numero: '20',
        bairro: 'Centro',
        cidade: 'São José do Egito',
        estado: 'PE',
        latitude: -8.051,
        longitude: -34.881,
      },
    });
    enderecoIds.push(end2.id);
    const e2 = await prisma.estabelecimento.create({
      data: {
        nome: `${prefixo} Policlínica do Sertão`,
        tipoId: tipoHospitalId,
        enderecoId: end2.id,
      },
    });
    idE2 = e2.id;
    estabelecimentoIds.push(idE2);

    // e3: "Hospital Unimed", Rua das Flores, Recife, especialidade "Clínica"
    const end3 = await prisma.endereco.create({
      data: {
        cep: '50000-003',
        logradouro: 'Rua das Flores',
        numero: '30',
        bairro: 'Centro',
        cidade: 'Recife',
        estado: 'PE',
        latitude: -8.0515,
        longitude: -34.8815,
      },
    });
    enderecoIds.push(end3.id);
    const e3 = await prisma.estabelecimento.create({
      data: {
        nome: `${prefixo} Hospital Unimed`,
        tipoId: tipoHospitalId,
        enderecoId: end3.id,
        especialidades: {
          create: [{ especialidadeId: esp1.id }],
        },
      },
    });
    idE3 = e3.id;
    estabelecimentoIds.push(idE3);

    // e4: "Clínica Unimar", Rua do Sol, Recife, "Clínica Geral"
    const end4 = await prisma.endereco.create({
      data: {
        cep: '50000-004',
        logradouro: 'Rua do Sol',
        numero: '40',
        bairro: 'Centro',
        cidade: 'Recife',
        estado: 'PE',
        latitude: -8.052,
        longitude: -34.882,
      },
    });
    enderecoIds.push(end4.id);
    const e4 = await prisma.estabelecimento.create({
      data: {
        nome: `${prefixo} Clínica Unimar`,
        tipoId: tipoHospitalId,
        enderecoId: end4.id,
        especialidades: {
          create: [{ especialidadeId: esp2.id }],
        },
      },
    });
    idE4 = e4.id;
    estabelecimentoIds.push(idE4);

    // e5: "Centro Médico Pina", Rua da Lua, Recife, "Clínica Médica"
    const end5 = await prisma.endereco.create({
      data: {
        cep: '50000-005',
        logradouro: 'Rua da Lua',
        numero: '50',
        bairro: 'Centro',
        cidade: 'Recife',
        estado: 'PE',
        latitude: -8.0525,
        longitude: -34.8825,
      },
    });
    enderecoIds.push(end5.id);
    const e5 = await prisma.estabelecimento.create({
      data: {
        nome: `${prefixo} Centro Médico Pina`,
        tipoId: tipoHospitalId,
        enderecoId: end5.id,
        especialidades: {
          create: [{ especialidadeId: esp3.id }],
        },
      },
    });
    idE5 = e5.id;
    estabelecimentoIds.push(idE5);

    // Checa disponibilidade do Elasticsearch
    esDisponivel = await buscaService.estaDisponivel();
    if (esDisponivel) {
      await buscaService.inicializarIndice();
      for (const id of estabelecimentoIds) {
        const estab = await estabelecimentosService.findOne(id);
        const doc = mapearEstabelecimentoParaDocumento(estab);
        await buscaService.indexarEstabelecimento(doc);
      }
      const cliente = buscaService.obterCliente();
      await cliente.indices.refresh({ index: 'estabelecimentos' });
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.estabelecimentoEspecialidade.deleteMany({
        where: { estabelecimentoId: { in: estabelecimentoIds } },
      });
      await prisma.estabelecimento.deleteMany({
        where: { id: { in: estabelecimentoIds } },
      });
      await prisma.endereco.deleteMany({
        where: { id: { in: enderecoIds } },
      });
    }

    if (esDisponivel && buscaService) {
      for (const id of estabelecimentoIds) {
        try {
          await buscaService.removerEstabelecimento(id);
        } catch {
          // ignora
        }
      }
    }

    if (app) {
      await app.close();
    }
  });

  it('Paridade Cidade: buscar "São José" retorna apenas e1 nos dois motores (não casa "São José do Egito")', async () => {
    // 1. No PostgreSQL (busca sem localização)
    const resPg = await estabelecimentosService.search({
      cidade: 'São José',
    });
    const idsPg = filtrarIdsDoTeste(resPg.dados);
    expect(idsPg).toEqual([idE1]);

    // 2. Busca com localização (Elasticsearch ou fallback)
    const resGeo = await estabelecimentosService.search({
      cidade: 'São José',
      lat: centroLat,
      lng: centroLng,
      raioKm: 10,
    });
    const idsGeo = filtrarIdsDoTeste(resGeo.dados);
    expect(idsGeo).toEqual([idE1]);

    // 3. Paridade estrita
    expect(idsGeo).toEqual(idsPg);
  });

  it('Paridade Especialidade: buscar "Clínica" retorna apenas e3 nos dois motores (não casa "Clínica Geral" nem "Clínica Médica")', async () => {
    // 1. No PostgreSQL (busca sem localização)
    const resPg = await estabelecimentosService.search({
      especialidade: 'Clínica',
    });
    const idsPg = filtrarIdsDoTeste(resPg.dados);
    expect(idsPg).toEqual([idE3]);

    // 2. Busca com localização
    const resGeo = await estabelecimentosService.search({
      especialidade: 'Clínica',
      lat: centroLat,
      lng: centroLng,
      raioKm: 10,
    });
    const idsGeo = filtrarIdsDoTeste(resGeo.dados);
    expect(idsGeo).toEqual([idE3]);

    // 3. Paridade estrita
    expect(idsGeo).toEqual(idsPg);
  });

  it('Paridade Termo sem Fuzziness: buscar "Unimed" retorna apenas e3 nos dois motores (não casa "Unimar")', async () => {
    // 1. No PostgreSQL (busca sem localização)
    const resPg = await estabelecimentosService.search({
      termo: 'Unimed',
    });
    const idsPg = filtrarIdsDoTeste(resPg.dados);
    expect(idsPg).toEqual([idE3]);

    // 2. Busca com localização
    const resGeo = await estabelecimentosService.search({
      termo: 'Unimed',
      lat: centroLat,
      lng: centroLng,
      raioKm: 10,
    });
    const idsGeo = filtrarIdsDoTeste(resGeo.dados);
    expect(idsGeo).toEqual([idE3]);

    // 3. Paridade estrita
    expect(idsGeo).toEqual(idsPg);
  });

  it('Paridade Logradouro fora do Termo (RN03): buscar "Rua das Flores" não retorna nenhum estabelecimento nos dois motores', async () => {
    // e1 e e3 têm logradouro "Rua das Flores", mas o termo NÃO pesquisa logradouro (RN03 / D13)
    // 1. No PostgreSQL
    const resPg = await estabelecimentosService.search({
      termo: 'Rua das Flores',
      estado: 'PE',
    });
    const idsPg = filtrarIdsDoTeste(resPg.dados);
    expect(idsPg).toEqual([]);

    // 2. Busca com localização
    const resGeo = await estabelecimentosService.search({
      termo: 'Rua das Flores',
      lat: centroLat,
      lng: centroLng,
      raioKm: 10,
    });
    const idsGeo = filtrarIdsDoTeste(resGeo.dados);
    expect(idsGeo).toEqual([]);

    // 3. Paridade estrita
    expect(idsGeo).toEqual(idsPg);
  });
});
