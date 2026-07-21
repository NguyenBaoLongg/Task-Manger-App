import { ProblemError } from '../foundation.js';

export function effectivePenaltyAmount(original: bigint, adjustments: bigint[]): bigint {
  if (original < 0n)
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Tiền phạt gốc không hợp lệ.');
  const result = adjustments.reduce((sum, delta) => sum + delta, original);
  if (result < 0n) {
    throw new ProblemError(422, 'BUSINESS_RULE_VIOLATION', 'Điều chỉnh làm tiền phạt nhỏ hơn 0.');
  }
  return result;
}

export function validatePenaltyAdjustment(
  original: bigint,
  currentAdjustments: bigint[],
  delta: bigint,
) {
  if (delta === 0n) throw new ProblemError(422, 'VALIDATION_FAILED', 'Điều chỉnh phải khác 0.');
  return effectivePenaltyAmount(original, [...currentAdjustments, delta]);
}
