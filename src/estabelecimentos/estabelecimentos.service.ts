import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, TipoMidia } from '@prisma/client';
import { randomUUID } from 'crypto';
import { normalizeContatos } from './contatos.util';
import { paginada } from '../common/dto/paginacao-query.dto';
import { validarRegrasGeograficas } from './dto/parse-buscar-estabelecimentos-query';
import {
  toEnderecoCreate,
  toEnderecoResponse,
  toEnderecoUpdate,
} from './endereco.util';
import { PrismaService } from '../database/prisma.service';
import { BuscaService } from '../busca/busca.service';
import { mapearEstabelecimentoParaDocumento } from '../busca/documento-estabelecimento';
import { AdicionarMidiaDto } from './dto/adicionar-midia.dto';
import { CriarEstabelecimentoDto } from './dto/criar-estabelecimento.dto';
import { BuscarEstabelecimentosDto } from './dto/buscar-estabelecimentos.dto';
import { DefinirHorariosDto } from './dto/definir-horarios.dto';
import { DefinirEspecialidadesDto } from './dto/definir-especialidades.dto';
import { AtualizarEstabelecimentoDto } from './dto/atualizar-estabelecimento.dto';
import { dateParaHora, horaParaDate } from './horario.util';
import {
  ALLOWED_IMAGE_MIMES,
  isAllowedImage,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UNIT_IMAGES,
  publicImageUrl,
} from './midia.util';

const estabelecimentoInclude = {
  tipo: true,
  endereco: true,
  contatos: { orderBy: [{ tipo: 'asc' as const }, { valor: 'asc' as const }] },
  especialidades: {
    include: { especialidade: true },
    orderBy: { especialidade: { nome: 'asc' as const } },
  },
  horarios: { orderBy: { diaSemana: 'asc' as const } },
  midias: {
    select: { id: true, tipo: true, url: true, legenda: true },
  },
};

type EstabelecimentoCompleto = Prisma.EstabelecimentoGetPayload<{
  include: typeof estabelecimentoInclude;
}>;

type Nota = { notaMedia: number; totalReviews: number };

const CARACTERES_ACENTUADOS = 'áàâãäéèêëíìîïóòôõöúùûüç';
const CARACTERES_SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuuc';

// Os tipos ficam gravados em maiúsculas: HOSPITAL e CLINICA (RN05).
function tipoEstabelecimentoArmazenado(tipo: string): string {
  return tipo.trim().toLocaleUpperCase('pt-BR');
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

@Injectable()
export class EstabelecimentosService {
  private readonly logger = new Logger(EstabelecimentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buscaService: BuscaService,
  ) {}

  listTypes() {
    return this.prisma.tipoEstabelecimento.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async search(query: BuscarEstabelecimentosDto) {
    const errosGeograficos = validarRegrasGeograficas(query);
    if (errosGeograficos.length > 0) {
      throw new BadRequestException({
        status: 400,
        mensagem: 'Parâmetros inválidos.',
        erros: errosGeograficos,
      });
    }

    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    // Busca por proximidade geográfica usando o Elasticsearch quando lat e lng forem informados
    if (query.lat !== undefined && query.lng !== undefined) {
      return this.buscarPorProximidade(query, pagina, limite);
    }

    const where: Prisma.EstabelecimentoWhereInput = {};

    if (query.tipo) {
      const tipo = query.tipo.trim();
      where.tipo = {
        nome: {
          equals: tipoEstabelecimentoArmazenado(tipo),
          mode: 'insensitive',
        },
      };
    }
    const texto = query.termo?.trim();
    const cidade = query.cidade?.trim();
    const especialidade = query.especialidade?.trim();
    if (texto || cidade || especialidade) {
      const estabelecimentos = await this.filtrarTexto({
        texto,
        cidade,
        especialidade,
      });
      where.id = { in: estabelecimentos };
    }
    if (query.estado) {
      where.endereco = {
        estado: { equals: query.estado.trim(), mode: 'insensitive' },
      };
    }

    const [total, estabelecimentos] = await this.prisma.$transaction([
      this.prisma.estabelecimento.count({ where }),
      this.prisma.estabelecimento.findMany({
        where,
        include: estabelecimentoInclude,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return paginada(
      estabelecimentos.map((item) => this.toBuscaResponse(item)),
      total,
      pagina,
      limite,
    );
  }

  private async buscarPorProximidade(
    query: BuscarEstabelecimentosDto,
    pagina: number,
    limite: number,
  ) {
    try {
      const resultado = await this.buscaService.buscarEstabelecimentos({
        termo: query.termo,
        tipo: query.tipo,
        especialidade: query.especialidade,
        cidade: query.cidade,
        estado: query.estado,
        localizacao: {
          lat: query.lat!,
          lon: query.lng!,
          raioKm: query.raioKm ?? 10,
        },
        pagina,
        limite,
      });

      const ids = resultado.itens.map((item) => item.estabelecimento.id);
      if (ids.length === 0) {
        return paginada([], resultado.total, pagina, limite);
      }

      // Os dados completos continuam vindo do PostgreSQL (RN11)
      const estabelecimentos = await this.prisma.estabelecimento.findMany({
        where: { id: { in: ids } },
        include: estabelecimentoInclude,
      });

      const mapa = new Map(estabelecimentos.map((item) => [item.id, item]));

      // Preserva rigorosamente a ordem de proximidade retornada pelo Elasticsearch
      const dados = resultado.itens
        .map((item) => {
          const estabelecimento = mapa.get(item.estabelecimento.id);
          if (!estabelecimento) return null;
          const distanciaKm =
            item.distanciaKm !== undefined
              ? Math.round(item.distanciaKm * 10) / 10
              : undefined;
          return this.toBuscaResponse(estabelecimento, distanciaKm);
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return paginada(dados, resultado.total, pagina, limite);
    } catch (erro) {
      if (erro instanceof BadRequestException) {
        throw erro;
      }
      this.logger.error(
        `Falha ao realizar busca por proximidade no Elasticsearch: ${String(erro)}`,
      );
      throw new ServiceUnavailableException(
        'Serviço de busca por localização temporariamente indisponível.',
      );
    }
  }

  private async filtrarTexto(filtros: {
    texto?: string;
    cidade?: string;
    especialidade?: string;
  }): Promise<string[]> {
    const condicoes: Prisma.Sql[] = [];
    const textoNormalizado = filtros.texto
      ? normalizarTexto(filtros.texto)
      : undefined;
    const cidadeNormalizada = filtros.cidade
      ? normalizarTexto(filtros.cidade)
      : undefined;
    const especialidadeNormalizada = filtros.especialidade
      ? normalizarTexto(filtros.especialidade)
      : undefined;

    if (textoNormalizado) {
      condicoes.push(Prisma.sql`(
        strpos(translate(lower(e."nome"), ${CARACTERES_ACENTUADOS}, ${CARACTERES_SEM_ACENTO}), ${textoNormalizado}) > 0
        OR strpos(translate(lower(a."cidade"), ${CARACTERES_ACENTUADOS}, ${CARACTERES_SEM_ACENTO}), ${textoNormalizado}) > 0
        OR strpos(translate(lower(a."bairro"), ${CARACTERES_ACENTUADOS}, ${CARACTERES_SEM_ACENTO}), ${textoNormalizado}) > 0
        OR EXISTS (
          SELECT 1
          FROM "estabelecimento_especialidades" ee
          JOIN "especialidades" esp ON esp."id" = ee."especialidadeId"
          WHERE ee."estabelecimentoId" = e."id"
            AND strpos(translate(lower(esp."nome"), ${CARACTERES_ACENTUADOS}, ${CARACTERES_SEM_ACENTO}), ${textoNormalizado}) > 0
        )
      )`);
    }
    if (cidadeNormalizada) {
      condicoes.push(
        Prisma.sql`translate(lower(a."cidade"), ${CARACTERES_ACENTUADOS}, ${CARACTERES_SEM_ACENTO}) = ${cidadeNormalizada}`,
      );
    }
    if (filtros.especialidade && especialidadeNormalizada) {
      condicoes.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM "estabelecimento_especialidades" ee
        JOIN "especialidades" esp ON esp."id" = ee."especialidadeId"
        WHERE ee."estabelecimentoId" = e."id"
          AND (
            esp."id" = ${filtros.especialidade}
            OR translate(lower(esp."nome"), ${CARACTERES_ACENTUADOS}, ${CARACTERES_SEM_ACENTO}) = ${especialidadeNormalizada}
          )
      )`);
    }

    if (condicoes.length === 0) {
      return [];
    }

    const matches = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT e."id"
        FROM "estabelecimentos" e
        JOIN "enderecos" a ON a."id" = e."enderecoId"
        WHERE ${Prisma.join(condicoes, ' AND ')}
      `,
    );
    return matches.map(({ id }) => id);
  }

  async findOne(id: string) {
    const estabelecimento = await this.findExisting(id);
    const notas = this.notas([id]);
    return this.toResponse(estabelecimento, notas.get(id));
  }

  async create(dto: CriarEstabelecimentoDto) {
    const tipoId = await this.tipoId(dto.tipo);
    const contatos = normalizeContatos(dto.contatos ?? []);
    const estabelecimento = await this.prisma.estabelecimento.create({
      data: {
        nome: dto.nome.trim(),
        tipo: { connect: { id: tipoId } },
        endereco: { create: toEnderecoCreate(dto.endereco) },
        contatos: { create: contatos },
      },
    });
    const resposta = await this.findOne(estabelecimento.id);
    await this.sincronizarComElasticsearch(estabelecimento.id);
    return resposta;
  }

  async update(id: string, dto: AtualizarEstabelecimentoDto) {
    await this.findExisting(id);
    const data: Prisma.EstabelecimentoUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome.trim();
    if (dto.tipo !== undefined) {
      data.tipo = { connect: { id: await this.tipoId(dto.tipo) } };
    }
    if (dto.endereco !== undefined) {
      data.endereco = { update: toEnderecoUpdate(dto.endereco) };
    }
    if (dto.contatos !== undefined) {
      data.contatos = {
        deleteMany: {},
        create: normalizeContatos(dto.contatos),
      };
    }
    await this.prisma.estabelecimento.update({ where: { id }, data });
    const resposta = await this.findOne(id);
    await this.sincronizarComElasticsearch(id);
    return resposta;
  }

  async remove(id: string) {
    const estabelecimento = await this.findExisting(id);
    await this.prisma.$transaction([
      this.prisma.estabelecimento.delete({ where: { id } }),
      this.prisma.endereco.delete({
        where: { id: estabelecimento.enderecoId },
      }),
    ]);
    await this.removerDoElasticsearch(id);
    return { message: 'Estabelecimento removido.' };
  }

  async setSpecialties(id: string, dto: DefinirEspecialidadesDto) {
    await this.findExisting(id);
    await this.assertEspecialidadesExist(dto.especialidadeIds);
    await this.prisma.$transaction([
      this.prisma.estabelecimentoEspecialidade.deleteMany({
        where: { estabelecimentoId: id },
      }),
      this.prisma.estabelecimentoEspecialidade.createMany({
        data: [...new Set(dto.especialidadeIds)].map((especialidadeId) => ({
          estabelecimentoId: id,
          especialidadeId,
        })),
      }),
    ]);
    const resposta = await this.findOne(id);
    await this.sincronizarComElasticsearch(id);
    return resposta;
  }

  async setOpeningHours(id: string, dto: DefinirHorariosDto) {
    await this.findExisting(id);
    const dias = dto.horarios.map((item) => item.diaSemana);
    if (new Set(dias).size !== dias.length) {
      throw new BadRequestException('Não repita o mesmo dia da semana.');
    }
    const horarios = dto.horarios.map((item) => {
      const atende24h = item.atende24h ?? false;
      const horaAbertura = atende24h ? '00:00' : item.horaAbertura!;
      const horaFechamento = atende24h ? '23:59' : item.horaFechamento!;
      if (horaAbertura >= horaFechamento) {
        throw new BadRequestException(
          'Horário de abertura deve ser anterior ao de fechamento.',
        );
      }
      return {
        estabelecimentoId: id,
        diaSemana: item.diaSemana,
        horaAbertura: horaParaDate(horaAbertura),
        horaFechamento: horaParaDate(horaFechamento),
        atende24h,
      };
    });
    await this.prisma.$transaction([
      this.prisma.horarioFuncionamento.deleteMany({
        where: { estabelecimentoId: id },
      }),
      this.prisma.horarioFuncionamento.createMany({ data: horarios }),
    ]);
    const resposta = await this.findOne(id);
    await this.sincronizarComElasticsearch(id);
    return resposta;
  }

  async sincronizarComElasticsearch(id: string): Promise<void> {
    try {
      const resposta = await this.findOne(id);
      const documento = mapearEstabelecimentoParaDocumento(resposta);
      await this.buscaService.indexarEstabelecimento(documento);
    } catch (erro) {
      this.logger.warn(
        `Falha ao sincronizar estabelecimento ${id} no Elasticsearch: ${String(erro)}`,
      );
    }
  }

  async removerDoElasticsearch(id: string): Promise<void> {
    try {
      await this.buscaService.removerEstabelecimento(id);
    } catch (erro) {
      this.logger.warn(
        `Falha ao remover estabelecimento ${id} do Elasticsearch: ${String(erro)}`,
      );
    }
  }

  async reindexarTodos(): Promise<{
    total: number;
    indexados: number;
    erros: number;
    falhas: Array<{ id: string; erro: string }>;
  }> {
    const todos = await this.prisma.estabelecimento.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    let indexados = 0;
    let erros = 0;
    const falhas: Array<{ id: string; erro: string }> = [];

    for (const item of todos) {
      try {
        const resposta = await this.findOne(item.id);
        const documento = mapearEstabelecimentoParaDocumento(resposta);
        await this.buscaService.indexarEstabelecimento(documento);
        indexados++;
      } catch (erro) {
        erros++;
        const mensagem = String(erro);
        this.logger.error(
          `Falha ao reindexar estabelecimento ${item.id}: ${mensagem}`,
        );
        falhas.push({ id: item.id, erro: mensagem });
      }
    }

    try {
      await this.buscaService
        .obterCliente()
        .indices.refresh({ index: 'estabelecimentos' });
    } catch {
      // Se refresh falhar, não impede o resultado
    }

    return {
      total: todos.length,
      indexados,
      erros,
      falhas,
    };
  }

  async addImage(
    id: string,
    file: Express.Multer.File,
    dto: AdicionarMidiaDto,
  ) {
    await this.findExisting(id);
    if (!file) {
      throw new BadRequestException('Envie um arquivo de imagem.');
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Imagem maior que 5MB.');
    }
    if (!isAllowedImage(file) || !ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Use JPG, PNG ou WEBP.');
    }
    const total = await this.prisma.midia.count({
      where: { estabelecimentoId: id },
    });
    if (total >= MAX_UNIT_IMAGES) {
      throw new BadRequestException('Limite de 50 imagens por unidade.');
    }

    const midiaId = randomUUID();
    await this.prisma.midia.create({
      data: {
        id: midiaId,
        estabelecimentoId: id,
        tipo: TipoMidia.FOTO,
        url: publicImageUrl(midiaId),
        legenda: dto.legenda?.trim() || null,
        bytes: new Uint8Array(file.buffer),
      },
    });
    return this.findOne(id);
  }

  async removeImage(id: string, midiaId: string) {
    const midia = await this.prisma.midia.findFirst({
      where: { id: midiaId, estabelecimentoId: id },
      select: { id: true, url: true },
    });
    if (!midia) {
      throw new NotFoundException('Imagem não encontrada.');
    }
    await this.prisma.midia.delete({ where: { id: midiaId } });
    return this.findOne(id);
  }

  private async assertEspecialidadesExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return;
    }
    const count = await this.prisma.especialidade.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new NotFoundException('Uma ou mais especialidades não existem.');
    }
  }

  private async findExisting(id: string): Promise<EstabelecimentoCompleto> {
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id },
      include: estabelecimentoInclude,
    });
    if (!estabelecimento) {
      throw new NotFoundException('Estabelecimento não encontrado.');
    }
    return estabelecimento;
  }

  private async tipoId(nome: string): Promise<string> {
    const tipo = await this.prisma.tipoEstabelecimento.findFirst({
      where: { nome: { equals: nome.trim(), mode: 'insensitive' } },
    });
    if (!tipo) {
      throw new BadRequestException(
        `Tipo de estabelecimento "${nome}" não existe.`,
      );
    }
    return tipo.id;
  }

  private notas(ids: string[]): Map<string, Nota> {
    if (ids.length === 0) {
      return new Map();
    }
    return new Map(
      ids.map((id) => [
        id,
        {
          notaMedia: 0,
          totalReviews: 0,
        },
      ]),
    );
  }

  private toResponse(item: EstabelecimentoCompleto, nota?: Nota) {
    return {
      ...this.toBuscaResponse(item),
      notaMedia: nota?.notaMedia ?? 0,
      totalReviews: nota?.totalReviews ?? 0,
    };
  }

  private toBuscaResponse(item: EstabelecimentoCompleto, distanciaKm?: number) {
    return {
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      endereco: toEnderecoResponse(item.endereco),
      contatos: item.contatos.map((contato) => ({
        id: contato.id,
        tipo: contato.tipo,
        valor: contato.valor,
      })),
      especialidades: item.especialidades.map(
        (ligacao) => ligacao.especialidade,
      ),
      horarios: item.horarios.map((horario) => ({
        id: horario.id,
        diaSemana: horario.diaSemana,
        horaAbertura: dateParaHora(horario.horaAbertura),
        horaFechamento: dateParaHora(horario.horaFechamento),
        atende24h: horario.atende24h,
      })),
      midias: item.midias,
      ...(distanciaKm !== undefined ? { distanciaKm } : {}),
    };
  }
}
