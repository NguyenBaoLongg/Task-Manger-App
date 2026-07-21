import { ProblemError } from '../foundation.js';
import type { EvidenceDebtStatus } from './types.js';

export function requiredEvidenceCount(input: {
  evidenceEnabled: boolean;
  kpisRequiringEvidence: number;
  formHasRevenue: boolean;
}) {
  if (!input.evidenceEnabled) return 0;
  return Math.max(0, input.kpisRequiringEvidence) + (input.formHasRevenue ? 1 : 0);
}

export function nextEvidenceState(input: {
  current: EvidenceDebtStatus;
  requiredCount: number;
  receivedCount: number;
  now: Date;
  deadlineAt: Date;
  waive?: boolean;
}): EvidenceDebtStatus {
  if (input.current !== 'WAITING_PHOTOS') return input.current;
  if (input.waive) return 'WAIVED';
  if (input.receivedCount >= input.requiredCount) return 'SATISFIED';
  if (input.now >= input.deadlineAt) return 'OVERDUE';
  return 'WAITING_PHOTOS';
}

export function assertNoPerceptualFraudDecision(): 'DISABLED_IN_MVP' {
  return 'DISABLED_IN_MVP';
}

export function validateEvidenceCounts(requiredCount: number, receivedCount: number) {
  if (requiredCount < 0 || receivedCount < 0) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Số lượng ảnh không hợp lệ.');
  }
}
