export interface AttendancePenaltyPolicySnapshot {
  lateFixed1To15Minor: bigint;
  lateExcessPerMinuteMinor: bigint;
  lateExcessAfterMinutes: number;
  lateMaxThresholdMinutes: number;
  lateMaxMinor: bigint;
  lateNoNoticeMinor: bigint;
  currency: 'VND';
}

export const defaultAttendancePenaltyPolicy: AttendancePenaltyPolicySnapshot = {
  lateFixed1To15Minor: 20_000n,
  lateExcessPerMinuteMinor: 2_000n,
  lateExcessAfterMinutes: 15,
  lateMaxThresholdMinutes: 90,
  lateMaxMinor: 200_000n,
  lateNoNoticeMinor: 100_000n,
  currency: 'VND',
};

export type LateNoticeStatus = 'APPROVED_ON_TIME' | 'SUBMITTED_LATE' | 'NONE';

export function calculateLatePenalty(input: {
  lateMinutes: number;
  monthlyLateSequence: number;
  noticeStatus: LateNoticeStatus;
  policy: AttendancePenaltyPolicySnapshot;
}) {
  if (input.lateMinutes <= 0) return null;
  const firstLateExempt = input.monthlyLateSequence === 1;
  const grossBase = firstLateExempt ? 0n : calculateLateBase(input.lateMinutes, input.policy);
  const discountAmountMinor = input.noticeStatus === 'APPROVED_ON_TIME' ? grossBase / 2n : 0n;
  const baseAmountMinor = grossBase - discountAmountMinor;
  const noNoticeAmountMinor =
    input.noticeStatus === 'APPROVED_ON_TIME' ? 0n : input.policy.lateNoNoticeMinor;
  return {
    baseAmountMinor,
    noNoticeAmountMinor,
    discountAmountMinor,
    totalAmountMinor: baseAmountMinor + noNoticeAmountMinor,
    firstLateExempt,
    currency: input.policy.currency,
  };
}

function calculateLateBase(lateMinutes: number, policy: AttendancePenaltyPolicySnapshot): bigint {
  if (lateMinutes <= 15) return policy.lateFixed1To15Minor;
  if (lateMinutes >= policy.lateMaxThresholdMinutes) return policy.lateMaxMinor;
  return BigInt(lateMinutes - policy.lateExcessAfterMinutes) * policy.lateExcessPerMinuteMinor;
}
