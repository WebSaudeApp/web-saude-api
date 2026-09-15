import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../common/dto/pagination-query.dto';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../database/prisma.service';
import type { AuditActionName } from './audit-action';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: {
    actorId: string;
    action: AuditActionName;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginated(logs, total, page, limit);
  }
}
