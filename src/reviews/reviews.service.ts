import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { paginated } from '../common/dto/pagination-query.dto';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../database/prisma.service';
import { publishedUnitWhere } from '../health-units/published-unit';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { computeAverageRating } from './review-rating.util';

const reviewInclude = {
  user: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByUnit(unitId: string, query: PaginationQueryDto) {
    await this.findPublishedUnit(unitId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { unitId };
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
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

  async listMine(user: AuthenticatedUser, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { userId: user.id };
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          ...reviewInclude,
          unit: { select: { id: true, name: true, city: true, state: true } },
        },
        orderBy: { createdAt: 'desc' },
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

  async create(user: AuthenticatedUser, unitId: string, dto: CreateReviewDto) {
    this.assertPatient(user);
    const unit = await this.findPublishedUnit(unitId);
    if (unit.ownerId === user.id) {
      throw new ForbiddenException('Você não pode avaliar a própria unidade.');
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          userId: user.id,
          unitId,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
        include: reviewInclude,
      });
      await this.recalculateAverage(unitId);
      return this.toResponse(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Você já avaliou esta unidade.');
      }
      throw error;
    }
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateReviewDto) {
    const review = await this.findOwned(user, id);
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.comment !== undefined
          ? { comment: dto.comment.trim() || null }
          : {}),
      },
      include: reviewInclude,
    });
    await this.recalculateAverage(review.unitId);
    return this.toResponse(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const review = await this.findOwned(user, id);
    await this.prisma.review.delete({ where: { id } });
    await this.recalculateAverage(review.unitId);
    return { message: 'Avaliação removida.' };
  }

  private async findOwned(user: AuthenticatedUser, id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException('Avaliação não encontrada.');
    }
    if (review.userId !== user.id) {
      throw new ForbiddenException(
        'Você não pode alterar a avaliação de outra pessoa.',
      );
    }
    return review;
  }

  private async findPublishedUnit(unitId: string) {
    const unit = await this.prisma.healthUnit.findFirst({
      where: { id: unitId, ...publishedUnitWhere },
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    return unit;
  }

  private assertPatient(user: AuthenticatedUser): void {
    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Apenas pacientes avaliam unidades.');
    }
  }

  private async recalculateAverage(unitId: string): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: { unitId },
      select: { rating: true },
    });
    await this.prisma.healthUnit.update({
      where: { id: unitId },
      data: {
        averageRating: computeAverageRating(reviews.map((item) => item.rating)),
      },
    });
  }

  private toResponse(
    review: Prisma.ReviewGetPayload<{ include: typeof reviewInclude }> & {
      unit?: { id: string; name: string; city: string; state: string };
    },
  ) {
    return {
      id: review.id,
      unitId: review.unitId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.user,
      ...(review.unit ? { unit: review.unit } : {}),
    };
  }
}
