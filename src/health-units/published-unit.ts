import { ApprovalStatus, HealthUnitStatus, Prisma } from '@prisma/client';

export const publishedUnitWhere: Prisma.HealthUnitWhereInput = {
  deletedAt: null,
  approvalStatus: ApprovalStatus.APPROVED,
  status: HealthUnitStatus.ACTIVE,
};
