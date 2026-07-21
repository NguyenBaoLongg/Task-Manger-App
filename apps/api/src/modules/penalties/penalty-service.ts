import { ProblemError } from '@adsup/domain';
import type { ActionItemRepository, PenaltyRepository } from '@adsup/database';

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const money = (value: unknown, fallback: bigint) => {
  if (typeof value === 'bigint') return value;
  if (value === undefined) return fallback;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return BigInt(value);
  }
  throw new ProblemError(422, 'VALIDATION_FAILED', 'So tien phat khong hop le.');
};

export class PenaltyService {
  constructor(
    private readonly repository: PenaltyRepository,
    private readonly actionItems?: ActionItemRepository,
  ) {}

  createPolicyVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string;
    effectiveFromDate: string;
    effectiveToDate?: string | null;
    lateFixed1To15Minor?: bigint;
    lateExcessPerMinuteMinor?: bigint;
    lateExcessAfterMinutes?: number;
    lateMaxThresholdMinutes?: number;
    lateMaxMinor?: bigint;
    lateNoNoticeMinor?: bigint;
    suddenLeaveNoNoticeMinor?: bigint;
    suddenLeaveOverLimitMinor?: bigint;
    leaveRuleViolationMinor?: bigint;
    monthlySuddenLeaveFreeDays?: number;
    monthlyAbsenceNotifyThresholdDays?: number;
    currency: 'VND';
    reason: string;
  }) {
    if (input.effectiveToDate && input.effectiveToDate < input.effectiveFromDate) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Khoang hieu luc policy khong hop le.');
    }
    if (input.scopeType === 'BRANCH' && !input.branchId) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Policy theo co so can branchId.');
    }
    return this.repository.createPolicyVersion({
      tenantId: input.tenantId,
      scopeType: input.scopeType,
      branchId: input.branchId ?? null,
      effectiveFromDate: dateOnly(input.effectiveFromDate),
      effectiveToDate: input.effectiveToDate ? dateOnly(input.effectiveToDate) : null,
      lateFixed1To15Minor: money(input.lateFixed1To15Minor, 20_000n),
      lateExcessPerMinuteMinor: money(input.lateExcessPerMinuteMinor, 2_000n),
      lateExcessAfterMinutes: input.lateExcessAfterMinutes ?? 15,
      lateMaxThresholdMinutes: input.lateMaxThresholdMinutes ?? 90,
      lateMaxMinor: money(input.lateMaxMinor, 200_000n),
      lateNoNoticeMinor: money(input.lateNoNoticeMinor, 100_000n),
      suddenLeaveNoNoticeMinor: money(input.suddenLeaveNoNoticeMinor, 50_000n),
      suddenLeaveOverLimitMinor: money(input.suddenLeaveOverLimitMinor, 100_000n),
      leaveRuleViolationMinor: money(input.leaveRuleViolationMinor, 200_000n),
      monthlySuddenLeaveFreeDays: input.monthlySuddenLeaveFreeDays ?? 1,
      monthlyAbsenceNotifyThresholdDays: input.monthlyAbsenceNotifyThresholdDays ?? 5,
      currency: input.currency,
      actorMembershipId: input.actorMembershipId,
      reason: input.reason,
      correlationId: input.correlationId,
    });
  }

  async listSettlements(input: {
    tenantId: string;
    yearMonth: string;
    branchId?: string;
    cursor?: string;
  }) {
    const items = await this.repository.listSettlements(input);
    return { items, pageInfo: { nextCursor: null } };
  }

  async transitionPayment(input: {
    tenantId: string;
    settlementId: string;
    actorMembershipId: string;
    correlationId: string;
    toStatus: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'WAIVED' | 'REFUNDED';
    amountMinor?: bigint;
    mediaObjectId?: string;
    reason: string;
    idempotencyKey?: string;
  }) {
    const updated = await this.repository.transitionPayment({
      tenantId: input.tenantId,
      settlementId: input.settlementId,
      toStatus: input.toStatus,
      amountMinor: input.amountMinor,
      mediaObjectId: input.mediaObjectId,
      actorMembershipId: input.actorMembershipId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey ?? input.correlationId,
      correlationId: input.correlationId,
    });
    await this.projectPaymentActionItem(updated, input.correlationId);
    return updated;
  }

  private async projectPaymentActionItem(
    settlement: {
      tenantId: string;
      id: string;
      membershipId: string;
      branchId: string;
      businessDate: Date;
      status: string;
      totalAmountMinor: bigint;
    },
    correlationId: string,
  ) {
    if (!this.actionItems) return;
    if (!['PENDING', 'REJECTED', 'CONFIRMED', 'WAIVED'].includes(settlement.status)) return;
    await this.actionItems.projectPenaltyPayment({
      tenantId: settlement.tenantId,
      ownerMembershipId: settlement.membershipId,
      branchId: settlement.branchId,
      sourceId: settlement.id,
      businessDate: settlement.businessDate,
      amountMinor: settlement.totalAmountMinor,
      state:
        settlement.status === 'CONFIRMED' || settlement.status === 'WAIVED' ? 'COMPLETED' : 'OPEN',
      title:
        settlement.status === 'REJECTED'
          ? 'Chung tu nop phat bi tu choi'
          : 'Can cap nhat trang thai nop phat',
      correlationId,
    });
  }
}
