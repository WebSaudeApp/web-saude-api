import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoMidia } from '@prisma/client';
import { randomUUID } from 'crypto';
import { normalizeContatos } from '../common/contatos.util';
import { paginated } from '../common/dto/pagination-query.dto';
import {
  toEnderecoCreate,
  toEnderecoResponse,
  toEnderecoUpdate,
} from '../common/endereco.util';
import { PrismaService } from '../database/prisma.service';
import { arredondarNota } from '../reviews/nota.util';
import { EspecialidadesService } from '../especialidades/especialidades.service';
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
  removeUploadedFile,
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

@Injectable()
export class EstabelecimentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly especialidadesService: EspecialidadesService,
  ) {}

  listTypes() {
    return this.prisma.tipoEstabelecimento.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async search(query: BuscarEstabelecimentosDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EstabelecimentoWhereInput = {};

    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      where.OR = [
        { nome: contains },
        { endereco: { cidade: contains } },
        { endereco: { bairro: contains } },
        { especialidades: { some: { especialidade: { nome: contains } } } },
      ];
    }
    if (query.tipo) {
      where.tipo = { nome: { equals: query.tipo, mode: 'insensitive' } };
    }
    if (query.cidade || query.estado) {
      where.endereco = {
        ...(query.cidade
          ? { cidade: { equals: query.cidade, mode: 'insensitive' } }
          : {}),
        ...(query.estado
          ? { estado: { equals: query.estado, mode: 'insensitive' } }
          : {}),
      };
    }
    if (query.especialidade) {
      where.especialidades = {
        some: {
          OR: [
            { especialidadeId: query.especialidade },
            {
              especialidade: {
                nome: { equals: query.especialidade, mode: 'insensitive' },
              },
            },
          ],
        },
      };
    }
    if (query.notaMinima) {
      const comNota = await this.prisma.review.groupBy({
        by: ['estabelecimentoId'],
        having: { nota: { _avg: { gte: query.notaMinima } } },
      });
      where.id = { in: comNota.map((item) => item.estabelecimentoId) };
    }

    const [total, estabelecimentos] = await this.prisma.$transaction([
      this.prisma.estabelecimento.count({ where }),
      this.prisma.estabelecimento.findMany({
        where,
        include: estabelecimentoInclude,
        orderBy: { nome: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const notas = await this.notas(estabelecimentos.map((item) => item.id));

    return paginated(
      estabelecimentos.map((item) => this.toResponse(item, notas.get(item.id))),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string) {
    const estabelecimento = await this.findExisting(id);
    const notas = await this.notas([id]);
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
    return this.findOne(estabelecimento.id);
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
    return this.findOne(id);
  }

  async remove(id: string) {
    const estabelecimento = await this.findExisting(id);
    await this.prisma.$transaction([
      this.prisma.estabelecimento.delete({ where: { id } }),
      this.prisma.endereco.delete({
        where: { id: estabelecimento.enderecoId },
      }),
    ]);
    return { message: 'Estabelecimento removido.' };
  }

  async setSpecialties(id: string, dto: DefinirEspecialidadesDto) {
    await this.findExisting(id);
    await this.especialidadesService.assertIdsExist(dto.especialidadeIds);
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
    return this.findOne(id);
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
    return this.findOne(id);
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
    await removeUploadedFile(midia.url);
    return this.findOne(id);
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

  private async notas(ids: string[]): Promise<Map<string, Nota>> {
    if (ids.length === 0) {
      return new Map();
    }
    const grupos = await this.prisma.review.groupBy({
      by: ['estabelecimentoId'],
      where: { estabelecimentoId: { in: ids } },
      _avg: { nota: true },
      _count: { _all: true },
    });
    return new Map(
      grupos.map((grupo) => [
        grupo.estabelecimentoId,
        {
          notaMedia: arredondarNota(grupo._avg.nota),
          totalReviews: grupo._count._all,
        },
      ]),
    );
  }

  private toResponse(item: EstabelecimentoCompleto, nota?: Nota) {
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
      notaMedia: nota?.notaMedia ?? 0,
      totalReviews: nota?.totalReviews ?? 0,
    };
  }
}
