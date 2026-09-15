import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  HealthUnitStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../database/prisma.service';
import { CreateSpecialtyDto } from '../specialties/dto/create-specialty.dto';
import { SpecialtiesService } from '../specialties/specialties.service';
import { toUserResponse } from '../users/dto/user-response.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { RejectUnitDto } from './dto/reject-unit.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

const pendingInclude = {
  owner: { select: { id: true, name: true, email: true } },
  specialties: { include: { specialty: true } },
  openingHours: { orderBy: { dayOfWeek: 'asc' as const } },
  images: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, url: true, isMain: true, createdAt: true },
  },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly specialtiesService: SpecialtiesService,
  ) {}

  async dashboard() {
    const [
      totalUsers,
      totalUnits,
      pendingUnits,
      approvedUnits,
      rejectedUnits,
      recentReviews,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.healthUnit.count({ where: { deletedAt: null } }),
      this.prisma.healthUnit.count({
        where: { deletedAt: null, approvalStatus: ApprovalStatus.PENDING },
      }),
      this.prisma.healthUnit.count({
        where: { deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
      }),
      this.prisma.healthUnit.count({
        where: { deletedAt: null, approvalStatus: ApprovalStatus.REJECTED },
      }),
      this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          unit: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      totalUsers,
      totalUnits,
      pendingUnits,
      approvedUnits,
      rejectedUnits,
      recentReviews,
    };
  }

  async listPending() {
    const units = await this.prisma.healthUnit.findMany({
      where: { deletedAt: null, approvalStatus: ApprovalStatus.PENDING },
      include: pendingInclude,
      orderBy: { updatedAt: 'asc' },
    });
    return units.map((unit) => this.toPendingResponse(unit));
  }

  async approve(admin: AuthenticatedUser, id: string) {
    const unit = await this.findPendingUnit(id);
    this.assertNotSelfOwned(admin, unit.ownerId);
    const updated = await this.prisma.healthUnit.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        status: HealthUnitStatus.ACTIVE,
        rejectionReason: null,
      },
      include: pendingInclude,
    });
    await this.auditService.log({
      actorId: admin.id,
      action: AuditAction.UNIT_APPROVED,
      entityType: 'HealthUnit',
      entityId: id,
      metadata: { name: updated.name },
    });
    return this.toPendingResponse(updated);
  }

  async reject(admin: AuthenticatedUser, id: string, dto: RejectUnitDto) {
    const unit = await this.findPendingUnit(id);
    this.assertNotSelfOwned(admin, unit.ownerId);
    const reason = dto.reason.trim();
    const updated = await this.prisma.healthUnit.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        status: HealthUnitStatus.INACTIVE,
        rejectionReason: reason,
      },
      include: pendingInclude,
    });
    await this.auditService.log({
      actorId: admin.id,
      action: AuditAction.UNIT_REJECTED,
      entityType: 'HealthUnit',
      entityId: id,
      metadata: { name: updated.name, reason },
    });
    return this.toPendingResponse(updated);
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginated(
      users.map((user) => toUserResponse(user)),
      total,
      page,
      limit,
    );
  }

  async setUserStatus(
    admin: AuthenticatedUser,
    id: string,
    dto: SetUserStatusDto,
  ) {
    if (admin.id === id) {
      throw new ForbiddenException('Você não pode alterar o próprio status.');
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Não é permitido alterar administradores.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (!dto.isActive) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return tx.user.update({
        where: { id },
        data: { isActive: dto.isActive },
      });
    });
    await this.auditService.log({
      actorId: admin.id,
      action: dto.isActive
        ? AuditAction.USER_ACTIVATED
        : AuditAction.USER_DEACTIVATED,
      entityType: 'User',
      entityId: id,
      metadata: { email: updated.email },
    });
    return toUserResponse(updated);
  }

  async createSpecialty(admin: AuthenticatedUser, dto: CreateSpecialtyDto) {
    const specialty = await this.specialtiesService.create(dto);
    await this.auditService.log({
      actorId: admin.id,
      action: AuditAction.SPECIALTY_CREATED,
      entityType: 'Specialty',
      entityId: specialty.id,
      metadata: { name: specialty.name },
    });
    return specialty;
  }

  async updateSpecialty(
    admin: AuthenticatedUser,
    id: string,
    dto: UpdateSpecialtyDto,
  ) {
    const specialty = await this.specialtiesService.update(id, dto.name);
    await this.auditService.log({
      actorId: admin.id,
      action: AuditAction.SPECIALTY_UPDATED,
      entityType: 'Specialty',
      entityId: id,
      metadata: { name: specialty.name },
    });
    return specialty;
  }

  async deleteSpecialty(admin: AuthenticatedUser, id: string) {
    const specialty = await this.specialtiesService.remove(id);
    await this.auditService.log({
      actorId: admin.id,
      action: AuditAction.SPECIALTY_DELETED,
      entityType: 'Specialty',
      entityId: id,
      metadata: { name: specialty.name },
    });
    return { message: 'Especialidade removida.' };
  }

  private async findPendingUnit(id: string) {
    const unit = await this.prisma.healthUnit.findFirst({
      where: { id, deletedAt: null },
      include: pendingInclude,
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    if (unit.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        'Só unidades em análise podem ser aprovadas ou rejeitadas.',
      );
    }
    return unit;
  }

  private assertNotSelfOwned(admin: AuthenticatedUser, ownerId: string): void {
    if (admin.id === ownerId) {
      throw new ForbiddenException(
        'Administradores não aprovam a própria unidade.',
      );
    }
  }

  private toPendingResponse(
    unit: Prisma.HealthUnitGetPayload<{ include: typeof pendingInclude }>,
  ) {
    return {
      id: unit.id,
      ownerId: unit.ownerId,
      owner: unit.owner,
      name: unit.name,
      type: unit.type,
      description: unit.description,
      city: unit.city,
      state: unit.state,
      status: unit.status,
      approvalStatus: unit.approvalStatus,
      rejectionReason: unit.rejectionReason,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      specialties: unit.specialties.map((item) => item.specialty),
      openingHours: unit.openingHours,
      images: unit.images,
    };
  }
}
