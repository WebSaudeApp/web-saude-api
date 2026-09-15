import { canSubmitApproval } from './unit-workflow.util';
import { ApprovalStatus } from '@prisma/client';

describe('unit workflow', () => {
  it('permite envio a partir de rascunho ou rejeição', () => {
    expect(canSubmitApproval(ApprovalStatus.DRAFT)).toBe(true);
    expect(canSubmitApproval(ApprovalStatus.REJECTED)).toBe(true);
    expect(canSubmitApproval(ApprovalStatus.PENDING)).toBe(false);
    expect(canSubmitApproval(ApprovalStatus.APPROVED)).toBe(false);
  });
});
