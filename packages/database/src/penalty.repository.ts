import type { DatabaseClient } from './client.js';
import { settlePenaltyComponents, type ViolationKind } from '@adsup/domain';
import type { Prisma } from './generated/prisma/client.js';

export class PenaltyRepository {
  constructor(private readonly db: DatabaseClient) {}

  getEffectiveAttendancePenaltyPolicy(
    tenantId: string,
    branchId: string | null,
    businessDate: Date,
  ) {
    return this.db.attendancePenaltyPolicyVersion.findFirst({
      where: {
        tenantId,
        effectiveFromDate: { lte: businessDate },
        OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: businessDate } }],
        AND: [{ OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] }],
      },
      orderBy: [{ scopeType: 'asc' }, { versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  listSettlements(input: {
    tenantId: string;
    yearMonth: string;
    branchId?: string;
    status?: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'WAIVED' | 'REFUNDED';
    take?: number;
  }) {
    return this.db.penaltySettlement.findMany({
      where: {
        tenantId: input.tenantId,
        settlementMonth: input.yearMonth,
        branchId: input.branchId,
        status: input.status,
      },
      orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(input.take ?? 50, 1), 200),
    });
  }

  getSettlement(tenantId: string, id: string) {
    return this.db.penaltySettlement.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  async createPolicyVersion(input: {
    tenantId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string | null;
    effectiveFromDate: Date;
    effectiveToDate?: Date | null;
    lateFixed1To15Minor: bigint;
    lateExcessPerMinuteMinor: bigint;
    lateExcessAfterMinutes: number;
    lateMaxThresholdMinutes: number;
    lateMaxMinor: bigint;
    lateNoNoticeMinor: bigint;
    suddenLeaveNoNoticeMinor: bigint;
    suddenLeaveOverLimitMinor: bigint;
    leaveRuleViolationMinor: bigint;
    monthlySuddenLeaveFreeDays: number;
    monthlyAbsenceNotifyThresholdDays: number;
    currency: 'VND';
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const latest = await tx.attendancePenaltyPolicyVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          branchId: input.branchId ?? null,
        },
        orderBy: { versionNumber: 'desc' },
      });
      const policy = await tx.attendancePenaltyPolicyVersion.create({
        data: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          branchId: input.branchId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          effectiveFromDate: input.effectiveFromDate,
          effectiveToDate: input.effectiveToDate,
          timezone: 'Asia/Ho_Chi_Minh',
          lateFixed1To15Minor: input.lateFixed1To15Minor,
          lateExcessPerMinuteMinor: input.lateExcessPerMinuteMinor,
          lateExcessAfterMinutes: input.lateExcessAfterMinutes,
          lateMaxThresholdMinutes: input.lateMaxThresholdMinutes,
          lateMaxMinor: input.lateMaxMinor,
          lateNoNoticeMinor: input.lateNoNoticeMinor,
          suddenLeaveNoNoticeMinor: input.suddenLeaveNoNoticeMinor,
          suddenLeaveOverLimitMinor: input.suddenLeaveOverLimitMinor,
          leaveRuleViolationMinor: input.leaveRuleViolationMinor,
          monthlySuddenLeaveFreeDays: input.monthlySuddenLeaveFreeDays,
          monthlyAbsenceNotifyThresholdDays: input.monthlyAbsenceNotifyThresholdDays,
          currency: input.currency,
          createdByMembershipId: input.actorMembershipId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'ATTENDANCE_PENALTY_POLICY_VERSION_CREATED',
          targetType: 'ATTENDANCE_PENALTY_POLICY_VERSION',
          targetId: policy.id,
          reason: input.reason,
          afterRedacted: {
            scopeType: policy.scopeType,
            branchId: policy.branchId,
            versionNumber: policy.versionNumber,
            currency: policy.currency,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'ATTENDANCE_PENALTY_POLICY_VERSION',
          aggregateId: policy.id,
          eventType: 'attendance.penalty-policy.version-created',
          dedupeKey: `attendance-penalty-policy:${policy.id}`,
          payloadRedacted: { policyVersionId: policy.id, scopeType: policy.scopeType },
          correlationId: input.correlationId,
        },
      });
      return policy;
    });
  }

  recordViolation(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    violationKind: ViolationKind;
    sourceType: string;
    sourceId: string;
    policyVersionId: string;
    amountMinor: bigint;
    currency: 'VND';
    detailsJson?: Record<string, unknown>;
    idempotencyKey: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const violation = await tx.attendanceViolation.upsert({
        where: {
          tenantId_violationKind_sourceType_sourceId_idempotencyKey: {
            tenantId: input.tenantId,
            violationKind: input.violationKind,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          branchId: input.branchId,
          businessDate: input.businessDate,
          violationKind: input.violationKind,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          policyVersionId: input.policyVersionId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          detailsJson: (input.detailsJson ?? {}) as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `attendance-violation:${violation.id}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'ATTENDANCE_VIOLATION',
          aggregateId: violation.id,
          eventType: 'attendance.violation.assessed',
          dedupeKey: `attendance-violation:${violation.id}`,
          payloadRedacted: {
            violationId: violation.id,
            membershipId: violation.membershipId,
            branchId: violation.branchId,
            violationKind: violation.violationKind,
            amountMinor: violation.amountMinor.toString(),
          },
          correlationId: input.correlationId,
        },
      });
      return violation;
    });
  }

  async upsertSettlementFromViolations(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    settlementMonth: string;
    policySnapshotJson?: Record<string, unknown>;
    correlationId: string;
  }) {
    const violations = await this.db.attendanceViolation.findMany({
      where: {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        branchId: input.branchId,
        businessDate: input.businessDate,
      },
      orderBy: [{ assessedAt: 'asc' }, { id: 'asc' }],
    });
    const settled = settlePenaltyComponents(
      violations.map((violation) => ({
        kind: violation.violationKind,
        amountMinor: violation.amountMinor,
        independent: isIndependentViolation(violation.violationKind),
        sourceId: violation.id,
      })),
    );
    const componentSnapshotJson = settled.components.map((component) => ({
      ...component,
      amountMinor: component.amountMinor.toString(),
    }));
    return this.db.$transaction(async (tx) => {
      const settlement = await tx.penaltySettlement.upsert({
        where: {
          tenantId_membershipId_businessDate_settlementMonth: {
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            businessDate: input.businessDate,
            settlementMonth: input.settlementMonth,
          },
        },
        update: {
          baseAmountMinor: settled.baseAmountMinor,
          independentAmountMinor: settled.independentAmountMinor,
          suppressedAmountMinor: settled.suppressedAmountMinor,
          totalAmountMinor: settled.totalAmountMinor,
          policySnapshotJson: (input.policySnapshotJson ?? {}) as Prisma.InputJsonValue,
          componentSnapshotJson: componentSnapshotJson as Prisma.InputJsonValue,
        },
        create: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          branchId: input.branchId,
          businessDate: input.businessDate,
          settlementMonth: input.settlementMonth,
          baseAmountMinor: settled.baseAmountMinor,
          independentAmountMinor: settled.independentAmountMinor,
          suppressedAmountMinor: settled.suppressedAmountMinor,
          totalAmountMinor: settled.totalAmountMinor,
          currency: 'VND',
          policySnapshotJson: (input.policySnapshotJson ?? {}) as Prisma.InputJsonValue,
          componentSnapshotJson: componentSnapshotJson as Prisma.InputJsonValue,
        },
      });
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `attendance-penalty-settlement:${settlement.id}:${settlement.updatedAt.getTime()}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'PENALTY_SETTLEMENT',
          aggregateId: settlement.id,
          eventType: 'attendance.penalty-settlement.updated',
          dedupeKey: `attendance-penalty-settlement:${settlement.id}:${settlement.updatedAt.getTime()}`,
          payloadRedacted: {
            settlementId: settlement.id,
            membershipId: settlement.membershipId,
            branchId: settlement.branchId,
            totalAmountMinor: settlement.totalAmountMinor.toString(),
            status: settlement.status,
          },
          correlationId: input.correlationId,
        },
      });
      return settlement;
    });
  }

  async transitionPayment(input: {
    tenantId: string;
    settlementId: string;
    toStatus: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'WAIVED' | 'REFUNDED';
    amountMinor?: bigint;
    mediaObjectId?: string | null;
    actorMembershipId: string;
    reason: string;
    idempotencyKey: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.penaltyPaymentTransition.findUnique({
        where: {
          tenantId_actorMembershipId_idempotencyKey: {
            tenantId: input.tenantId,
            actorMembershipId: input.actorMembershipId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        return tx.penaltySettlement.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: input.tenantId, id: existing.settlementId } },
        });
      }
      const settlement = await tx.penaltySettlement.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.settlementId } },
      });
      await tx.penaltyPaymentTransition.create({
        data: {
          tenantId: input.tenantId,
          settlementId: settlement.id,
          fromStatus: settlement.status,
          toStatus: input.toStatus,
          amountMinor: input.amountMinor,
          mediaObjectId: input.mediaObjectId,
          actorMembershipId: input.actorMembershipId,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const updated = await tx.penaltySettlement.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: settlement.id } },
        data: { status: input.toStatus },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'PENALTY_PAYMENT_TRANSITION_CREATED',
          targetType: 'PENALTY_SETTLEMENT',
          targetId: settlement.id,
          reason: input.reason,
          beforeRedacted: { status: settlement.status },
          afterRedacted: { status: updated.status, amountMinor: input.amountMinor?.toString() },
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'PENALTY_SETTLEMENT',
          aggregateId: settlement.id,
          eventType: 'attendance.penalty-payment.transitioned',
          dedupeKey: `attendance-penalty-payment:${input.tenantId}:${input.idempotencyKey}`,
          payloadRedacted: {
            settlementId: settlement.id,
            membershipId: settlement.membershipId,
            branchId: settlement.branchId,
            status: updated.status,
          },
          correlationId: input.correlationId,
        },
      });
      return updated;
    });
  }

  getClient() {
    return this.db;
  }
}

function isIndependentViolation(kind: ViolationKind) {
  return [
    'LATE_NO_NOTICE',
    'SUDDEN_LEAVE_NO_NOTICE',
    'SUDDEN_LEAVE_OVER_LIMIT',
    'LEAVE_RULE_VIOLATION',
  ].includes(kind);
}
