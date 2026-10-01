import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeContatos } from '../common/contatos.util';
import type { EnderecoDto } from '../common/dto/endereco.dto';
import { paginated } from '../common/dto/pagination-query.dto';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  toEnderecoCreate,
  toEnderecoResponse,
  toEnderecoUpdate,
} from '../common/endereco.util';
import { PrismaService } from '../database/prisma.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';

const usuarioInclude = {
  tipo: true,
  endereco: true,
  contatos: { orderBy: [{ tipo: 'asc' as const }, { valor: 'asc' as const }] },
};

type UsuarioCompleto = Prisma.UsuarioGetPayload<{
  include: typeof usuarioInclude;
}>;

const ENDERECO_OBRIGATORIOS = [
  'cep',
  'logradouro',
  'numero',
  'cidade',
  'estado',
] as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listTypes() {
    return this.prisma.tipoUsuario.findMany({ orderBy: { nome: 'asc' } });
  }

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [total, usuarios] = await this.prisma.$transaction([
      this.prisma.usuario.count(),
      this.prisma.usuario.findMany({
        include: usuarioInclude,
        orderBy: { nome: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginated(
      usuarios.map((usuario) => this.toResponse(usuario)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string) {
    return this.toResponse(await this.findExisting(id));
  }

  async create(dto: CriarUsuarioDto) {
    const tipoId = await this.tipoId(dto.tipo);
    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome.trim(),
        cpf: this.normalizeCpf(dto.cpf),
        genero: dto.genero?.trim() || null,
        tipo: { connect: { id: tipoId } },
        ...(dto.endereco
          ? { endereco: { create: toEnderecoCreate(dto.endereco) } }
          : {}),
        contatos: { create: normalizeContatos(dto.contatos ?? []) },
      },
    });
    return this.findOne(usuario.id);
  }

  async update(id: string, dto: AtualizarUsuarioDto) {
    const atual = await this.findExisting(id);
    const data: Prisma.UsuarioUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome.trim();
    if (dto.cpf !== undefined) data.cpf = this.normalizeCpf(dto.cpf);
    if (dto.genero !== undefined) data.genero = dto.genero.trim() || null;
    if (dto.tipo !== undefined) {
      data.tipo = { connect: { id: await this.tipoId(dto.tipo) } };
    }
    if (dto.endereco !== undefined) {
      data.endereco = atual.endereco
        ? { update: toEnderecoUpdate(dto.endereco) }
        : { create: toEnderecoCreate(this.enderecoCompleto(dto.endereco)) };
    }
    if (dto.contatos !== undefined) {
      data.contatos = {
        deleteMany: {},
        create: normalizeContatos(dto.contatos),
      };
    }
    await this.prisma.usuario.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: string) {
    const usuario = await this.findExisting(id);
    await this.prisma.$transaction([
      this.prisma.usuario.delete({ where: { id } }),
      ...(usuario.enderecoId
        ? [this.prisma.endereco.delete({ where: { id: usuario.enderecoId } })]
        : []),
    ]);
    return { message: 'Usuário removido.' };
  }

  private async findExisting(id: string): Promise<UsuarioCompleto> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: usuarioInclude,
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return usuario;
  }

  private async tipoId(nome: string): Promise<string> {
    const tipo = await this.prisma.tipoUsuario.findFirst({
      where: { nome: { equals: nome.trim(), mode: 'insensitive' } },
    });
    if (!tipo) {
      throw new BadRequestException(`Tipo de usuário "${nome}" não existe.`);
    }
    return tipo.id;
  }

  private normalizeCpf(cpf: string | undefined): string | null {
    const digits = cpf?.replace(/\D/g, '') ?? '';
    return digits.length > 0 ? digits : null;
  }

  private enderecoCompleto(endereco: Partial<EnderecoDto>): EnderecoDto {
    const faltando = ENDERECO_OBRIGATORIOS.filter(
      (campo) => endereco[campo] === undefined,
    );
    if (faltando.length > 0) {
      throw new BadRequestException(
        `Usuário sem endereço: informe ${faltando.join(', ')}.`,
      );
    }
    return endereco as EnderecoDto;
  }

  private toResponse(usuario: UsuarioCompleto) {
    return {
      id: usuario.id,
      nome: usuario.nome,
      cpf: usuario.cpf,
      genero: usuario.genero,
      tipo: usuario.tipo,
      endereco: usuario.endereco ? toEnderecoResponse(usuario.endereco) : null,
      contatos: usuario.contatos.map((contato) => ({
        id: contato.id,
        tipo: contato.tipo,
        valor: contato.valor,
      })),
    };
  }
}
