import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../common/dto/pagination-query.dto';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../database/prisma.service';
import { CriarReviewDto } from './dto/criar-review.dto';
import { AtualizarReviewDto } from './dto/atualizar-review.dto';

const reviewInclude = {
  autor: { select: { id: true, nome: true } },
  estabelecimento: { select: { id: true, nome: true } },
} as const;

type ReviewCompleta = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByEstabelecimento(
    estabelecimentoId: string,
    query: PaginationQueryDto,
  ) {
    await this.assertEstabelecimento(estabelecimentoId);
    return this.list({ estabelecimentoId }, query);
  }

  async listByAutor(autorId: string, query: PaginationQueryDto) {
    const autor = await this.prisma.usuario.findUnique({
      where: { id: autorId },
    });
    if (!autor) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return this.list({ autorId }, query);
  }

  async create(estabelecimentoId: string, dto: CriarReviewDto) {
    await this.assertEstabelecimento(estabelecimentoId);
    const autor = await this.prisma.usuario.findUnique({
      where: { id: dto.autorId },
    });
    if (!autor) {
      throw new NotFoundException('Usuário autor não encontrado.');
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          autorId: dto.autorId,
          estabelecimentoId,
          nota: dto.nota,
          comentario: dto.comentario?.trim() || null,
        },
        include: reviewInclude,
      });
      return this.toResponse(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Este usuário já avaliou este estabelecimento.',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: AtualizarReviewDto) {
    await this.findOrThrow(id);
    const review = await this.prisma.review.update({
      where: { id },
      data: {
        ...(dto.nota !== undefined ? { nota: dto.nota } : {}),
        ...(dto.comentario !== undefined
          ? { comentario: dto.comentario.trim() || null }
          : {}),
      },
      include: reviewInclude,
    });
    return this.toResponse(review);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Avaliação removida.' };
  }

  private async list(
    where: Prisma.ReviewWhereInput,
    query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginated(
      reviews.map((review) => this.toResponse(review)),
      total,
      page,
      limit,
    );
  }

  private async findOrThrow(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException('Avaliação não encontrada.');
    }
    return review;
  }

  private async assertEstabelecimento(id: string): Promise<void> {
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!estabelecimento) {
      throw new NotFoundException('Estabelecimento não encontrado.');
    }
  }

  private toResponse(review: ReviewCompleta) {
    return {
      id: review.id,
      nota: review.nota,
      comentario: review.comentario,
      criadoEm: review.criadoEm,
      autor: review.autor,
      estabelecimento: review.estabelecimento,
    };
  }
}
