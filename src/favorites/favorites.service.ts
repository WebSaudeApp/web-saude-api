import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../database/prisma.service';
import { publishedUnitWhere } from '../health-units/published-unit';

const favoriteInclude = {
  unit: {
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      state: true,
      averageRating: true,
      images: {
        where: { isMain: true },
        take: 1,
        select: { id: true, url: true, isMain: true },
      },
    },
  },
} as const;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: AuthenticatedUser) {
    this.assertPatient(user);
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      include: favoriteInclude,
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((item) => this.toResponse(item));
  }

  async add(user: AuthenticatedUser, unitId: string) {
    this.assertPatient(user);
    await this.findPublishedUnit(unitId);
    try {
      const favorite = await this.prisma.favorite.create({
        data: { userId: user.id, unitId },
        include: favoriteInclude,
      });
      return this.toResponse(favorite);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Unidade já está nos favoritos.');
      }
      throw error;
    }
  }

  async remove(user: AuthenticatedUser, unitId: string) {
    this.assertPatient(user);
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_unitId: { userId: user.id, unitId } },
    });
    if (!favorite) {
      throw new NotFoundException('Favorito não encontrado.');
    }
    await this.prisma.favorite.delete({
      where: { userId_unitId: { userId: user.id, unitId } },
    });
    return { message: 'Favorito removido.' };
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
      throw new ForbiddenException('Apenas pacientes favoritam unidades.');
    }
  }

  private toResponse(
    favorite: Prisma.FavoriteGetPayload<{ include: typeof favoriteInclude }>,
  ) {
    return {
      unitId: favorite.unitId,
      createdAt: favorite.createdAt,
      unit: {
        ...favorite.unit,
        averageRating: Number(favorite.unit.averageRating),
      },
    };
  }
}
