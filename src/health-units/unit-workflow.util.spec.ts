import {
  canEditWhileWaiting,
  canSubmitApproval,
  canTogglePublication,
} from './unit-workflow.util';
import { ApprovalStatus } from '@prisma/client';

describe('unit workflow', () => {
  it('permite envio a partir de rascunho ou rejeição', () => {
    expect(canSubmitApproval(ApprovalStatus.DRAFT)).toBe(true);
    expect(canSubmitApproval(ApprovalStatus.REJECTED)).toBe(true);
    expect(canSubmitApproval(ApprovalStatus.PENDING)).toBe(false);
    expect(canSubmitApproval(ApprovalStatus.APPROVED)).toBe(false);
  });

  it('bloqueia edição enquanto a unidade está em análise', () => {
    expect(canEditWhileWaiting(ApprovalStatus.PENDING)).toBe(false);
    expect(canEditWhileWaiting(ApprovalStatus.DRAFT)).toBe(true);
    expect(canEditWhileWaiting(ApprovalStatus.REJECTED)).toBe(true);
  });

  it('só unidade aprovada altera publicação', () => {
    expect(canTogglePublication(ApprovalStatus.APPROVED)).toBe(true);
    expect(canTogglePublication(ApprovalStatus.PENDING)).toBe(false);
  });
});
