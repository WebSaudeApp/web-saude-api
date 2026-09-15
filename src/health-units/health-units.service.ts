import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  HealthUnit,
  HealthUnitStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { paginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../database/prisma.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateHealthUnitDto } from './dto/create-health-unit.dto';
import { SearchHealthUnitsDto } from './dto/search-health-units.dto';
import { SetOpeningHoursDto } from './dto/set-opening-hours.dto';
import { SetSpecialtiesDto } from './dto/set-specialties.dto';
import { UpdateHealthUnitDto } from './dto/update-health-unit.dto';
import { MineHealthUnitsQueryDto } from './dto/mine-health-units-query.dto';
import { SetUnitStatusDto } from './dto/set-unit-status.dto';
import {
  canEditWhileWaiting,
  canSubmitApproval,
  canTogglePublication,
} from './unit-workflow.util';
import {
  ALLOWED_IMAGE_MIMES,
  isAllowedImage,
  MAX_IMAGE_SIZE_BYTES,
  MAX_UNIT_IMAGES,
  publicImageUrl,
  removeUploadedFile,
} from './images/unit-image.util';

const imageSelect = {
  id: true,
  url: true,
  isMain: true,
  createdAt: true,
} as const;

const unitInclude = {
  specialties: { include: { specialty: true } },
  openingHours: { orderBy: { dayOfWeek: 'asc' as const } },
  images: { orderBy: { createdAt: 'asc' as const }, select: imageSelect },
};

@Injectable()
export class HealthUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly specialtiesService: SpecialtiesService,
  ) {}

  async search(query: SearchHealthUnitsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.HealthUnitWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      status: HealthUnitStatus.ACTIVE,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        {
          specialties: {
            some: {
              specialty: {
                name: { contains: query.search, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }
    if (query.city) {
      where.city = { equals: query.city, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = { equals: query.state.toUpperCase(), mode: 'insensitive' };
    }
    if (query.specialty) {
      where.specialties = {
        some: {
          OR: [
            { specialtyId: query.specialty },
            {
              specialty: {
                name: { equals: query.specialty, mode: 'insensitive' },
              },
            },
          ],
        },
      };
    }
    if (query.rating) {
      where.averageRating = { gte: query.rating };
    }

    const orderBy: Prisma.HealthUnitOrderByWithRelationInput =
      query.sort === 'name'
        ? { name: 'asc' }
        : query.sort === 'rating'
          ? { averageRating: 'desc' }
          : { createdAt: 'desc' };

    const [total, units] = await this.prisma.$transaction([
      this.prisma.healthUnit.count({ where }),
      this.prisma.healthUnit.findMany({
        where,
        include: unitInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return paginated(
      units.map((unit) => this.toResponse(unit)),
      total,
      page,
      limit,
    );
  }

  async create(user: AuthenticatedUser, dto: CreateHealthUnitDto) {
    this.assertFunctional(user);
    const unit = await this.prisma.healthUnit.create({
      data: {
        ownerId: user.id,
        ...this.toCreateData(dto),
        approvalStatus: ApprovalStatus.DRAFT,
        status: HealthUnitStatus.INACTIVE,
      },
      include: unitInclude,
    });
    return this.toResponse(unit);
  }

  async findMine(user: AuthenticatedUser, query: MineHealthUnitsQueryDto = {}) {
    this.assertFunctional(user);
    const units = await this.prisma.healthUnit.findMany({
      where: {
        ownerId: user.id,
        deletedAt: null,
        ...(query.approvalStatus
          ? { approvalStatus: query.approvalStatus }
          : {}),
      },
      include: unitInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return units.map((unit) => this.toResponse(unit));
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const unit = await this.findExisting(id);
    if (
      !this.isPublished(unit) &&
      !(user && (user.id === unit.ownerId || user.role === UserRole.ADMIN))
    ) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    let isFavorite = false;
    if (user) {
      const favorite = await this.prisma.favorite.findUnique({
        where: { userId_unitId: { userId: user.id, unitId: id } },
      });
      isFavorite = Boolean(favorite);
    }
    return this.toResponse(unit, isFavorite);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateHealthUnitDto) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    this.assertEditable(unit);
    const updated = await this.prisma.healthUnit.update({
      where: { id },
      data: this.toUpdateData(dto),
      include: unitInclude,
    });
    return this.toResponse(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    await this.prisma.healthUnit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Unidade removida.' };
  }

  async submit(user: AuthenticatedUser, id: string) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    if (!canSubmitApproval(unit.approvalStatus)) {
      throw new BadRequestException(
        unit.approvalStatus === ApprovalStatus.PENDING
          ? 'Esta unidade já está em análise.'
          : 'Só rascunhos ou unidades rejeitadas podem ser enviadas.',
      );
    }
    if (unit.specialties.length === 0) {
      throw new BadRequestException('Cadastre ao menos uma especialidade.');
    }
    if (unit.openingHours.length === 0) {
      throw new BadRequestException(
        'Cadastre ao menos um horário de funcionamento.',
      );
    }
    const updated = await this.prisma.healthUnit.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.PENDING,
        status: HealthUnitStatus.INACTIVE,
        rejectionReason: null,
      },
      include: unitInclude,
    });
    return this.toResponse(updated);
  }

  async withdraw(user: AuthenticatedUser, id: string) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    if (unit.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        'Só é possível cancelar o envio de uma unidade em análise.',
      );
    }
    const updated = await this.prisma.healthUnit.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.DRAFT,
        status: HealthUnitStatus.INACTIVE,
      },
      include: unitInclude,
    });
    return this.toResponse(updated);
  }

  async setPublicationStatus(
    user: AuthenticatedUser,
    id: string,
    dto: SetUnitStatusDto,
  ) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    if (!canTogglePublication(unit.approvalStatus)) {
      throw new BadRequestException(
        'Só unidades aprovadas alteram o status de publicação.',
      );
    }
    const updated = await this.prisma.healthUnit.update({
      where: { id },
      data: { status: dto.status },
      include: unitInclude,
    });
    return this.toResponse(updated);
  }

  async setSpecialties(
    user: AuthenticatedUser,
    id: string,
    dto: SetSpecialtiesDto,
  ) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    this.assertEditable(unit);
    await this.specialtiesService.assertIdsExist(dto.specialtyIds);
    await this.prisma.$transaction([
      this.prisma.unitSpecialty.deleteMany({ where: { unitId: id } }),
      ...dto.specialtyIds.map((specialtyId) =>
        this.prisma.unitSpecialty.create({
          data: { unitId: id, specialtyId },
        }),
      ),
    ]);
    return this.findOne(id, user);
  }

  async setOpeningHours(
    user: AuthenticatedUser,
    id: string,
    dto: SetOpeningHoursDto,
  ) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    this.assertEditable(unit);
    const days = dto.hours.map((item) => item.dayOfWeek);
    if (new Set(days).size !== days.length) {
      throw new BadRequestException('Não repita o mesmo dia da semana.');
    }
    for (const item of dto.hours) {
      if (item.openTime >= item.closeTime) {
        throw new BadRequestException(
          'Horário de abertura deve ser anterior ao de fechamento.',
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.openingHour.deleteMany({ where: { unitId: id } }),
      ...dto.hours.map((item) =>
        this.prisma.openingHour.create({
          data: {
            unitId: id,
            dayOfWeek: item.dayOfWeek,
            openTime: item.openTime,
            closeTime: item.closeTime,
            active: item.active,
          },
        }),
      ),
    ]);
    return this.findOne(id, user);
  }

  async addImage(
    user: AuthenticatedUser,
    id: string,
    file: Express.Multer.File,
  ) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    this.assertEditable(unit);
    if (!file) {
      throw new BadRequestException('Envie um arquivo de imagem.');
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Imagem maior que 5MB.');
    }
    if (!isAllowedImage(file) || !ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Use JPG, PNG ou WEBP.');
    }
    if (unit.images.length >= MAX_UNIT_IMAGES) {
      throw new BadRequestException('Limite de 50 imagens por unidade.');
    }

    const imageId = randomUUID();
    await this.prisma.unitImage.create({
      data: {
        id: imageId,
        unitId: id,
        url: publicImageUrl(imageId),
        isMain: unit.images.length === 0,
        bytes: new Uint8Array(file.buffer),
      },
    });
    return this.findOne(id, user);
  }

  async setMainImage(user: AuthenticatedUser, id: string, imageId: string) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    this.assertEditable(unit);
    const image = unit.images.find((item) => item.id === imageId);
    if (!image) {
      throw new NotFoundException('Imagem não encontrada.');
    }
    await this.prisma.$transaction([
      this.prisma.unitImage.updateMany({
        where: { unitId: id },
        data: { isMain: false },
      }),
      this.prisma.unitImage.update({
        where: { id: imageId },
        data: { isMain: true },
      }),
    ]);
    return this.findOne(id, user);
  }

  async removeImage(user: AuthenticatedUser, id: string, imageId: string) {
    const unit = await this.findExisting(id);
    this.assertOwner(user, unit.ownerId);
    this.assertEditable(unit);
    const image = unit.images.find((item) => item.id === imageId);
    if (!image) {
      throw new NotFoundException('Imagem não encontrada.');
    }
    await this.prisma.unitImage.delete({ where: { id: imageId } });
    await removeUploadedFile(image.url);
    if (image.isMain) {
      const next = unit.images.find((item) => item.id !== imageId);
      if (next) {
        await this.prisma.unitImage.update({
          where: { id: next.id },
          data: { isMain: true },
        });
      }
    }
    return this.findOne(id, user);
  }

  private async findExisting(id: string) {
    const unit = await this.prisma.healthUnit.findFirst({
      where: { id, deletedAt: null },
      include: unitInclude,
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    return unit;
  }

  private isPublished(unit: HealthUnit): boolean {
    return (
      unit.approvalStatus === ApprovalStatus.APPROVED &&
      unit.status === HealthUnitStatus.ACTIVE
    );
  }

  private assertFunctional(user: AuthenticatedUser): void {
    if (user.role !== UserRole.FUNCTIONAL && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas gestores podem cadastrar unidades.');
    }
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Administradores não cadastram unidade por esta rota.',
      );
    }
  }

  private assertOwner(user: AuthenticatedUser, ownerId: string): void {
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Administradores não editam unidades por esta rota.',
      );
    }
    if (user.id !== ownerId) {
      throw new ForbiddenException(
        'Você não pode editar a unidade de outro gestor.',
      );
    }
  }

  private assertEditable(unit: HealthUnit): void {
    if (!canEditWhileWaiting(unit.approvalStatus)) {
      throw new ConflictException(
        'Unidade em análise. Cancele o envio para editar.',
      );
    }
  }

  private toCreateData(dto: CreateHealthUnitDto) {
    return {
      name: dto.name.trim(),
      type: dto.type,
      description: dto.description,
      email: dto.email,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      website: dto.website,
      street: dto.street.trim(),
      number: dto.number.trim(),
      complement: dto.complement,
      city: dto.city.trim(),
      state: dto.state.trim().toUpperCase(),
      cep: dto.cep.replace(/\D/g, ''),
      latitude: dto.latitude,
      longitude: dto.longitude,
    };
  }

  private toUpdateData(dto: UpdateHealthUnitDto) {
    const data: Prisma.HealthUnitUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.whatsapp !== undefined) data.whatsapp = dto.whatsapp;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.street !== undefined) data.street = dto.street.trim();
    if (dto.number !== undefined) data.number = dto.number.trim();
    if (dto.complement !== undefined) data.complement = dto.complement;
    if (dto.city !== undefined) data.city = dto.city.trim();
    if (dto.state !== undefined) data.state = dto.state.trim().toUpperCase();
    if (dto.cep !== undefined) data.cep = dto.cep.replace(/\D/g, '');
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    return data;
  }

  private toResponse(
    unit: Prisma.HealthUnitGetPayload<{ include: typeof unitInclude }>,
    isFavorite = false,
  ) {
    return {
      id: unit.id,
      ownerId: unit.ownerId,
      name: unit.name,
      type: unit.type,
      description: unit.description,
      email: unit.email,
      phone: unit.phone,
      whatsapp: unit.whatsapp,
      website: unit.website,
      status: unit.status,
      approvalStatus: unit.approvalStatus,
      rejectionReason: unit.rejectionReason,
      street: unit.street,
      number: unit.number,
      complement: unit.complement,
      city: unit.city,
      state: unit.state,
      cep: unit.cep,
      latitude: unit.latitude === null ? null : Number(unit.latitude),
      longitude: unit.longitude === null ? null : Number(unit.longitude),
      averageRating: Number(unit.averageRating),
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      specialties: unit.specialties.map((item) => item.specialty),
      openingHours: unit.openingHours,
      images: unit.images,
      isFavorite,
    };
  }
}
