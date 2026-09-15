import { ApprovalStatus } from '@prisma/client';

export function canSubmitApproval(status: ApprovalStatus): boolean {
  return status === ApprovalStatus.DRAFT || status === ApprovalStatus.REJECTED;
}

export function canEditWhileWaiting(status: ApprovalStatus): boolean {
  return status !== ApprovalStatus.PENDING;
}

export function canTogglePublication(status: ApprovalStatus): boolean {
  return status === ApprovalStatus.APPROVED;
}
