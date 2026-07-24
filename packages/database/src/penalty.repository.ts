import { runInTransaction, type DatabaseExecutor, type DatabaseTransaction } from './client.js';
import {
  assertPenaltyPaymentTransition,
  calculateLatePenalty,
  expandLeaveDates,
  ProblemError,
  settlePenaltyComponents,
  type ViolationKind,
} from '@adsup/domain';
import type { Prisma } from './generated/prisma/client.js';

export class PenaltyRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  inTransaction(transaction: DatabaseTransaction) {
    return new PenaltyRepository(transaction);
  }

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
      orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  listSettlements(input: {
    tenantId: string;
    yearMonth: string;
    branchId?: string;
    membershipId?: string;
    status?: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'WAIVED' | 'REFUNDED';
    take?: number;
  }) {
    return this.db.penaltySettlement.findMany({
      where: {
        tenantId: input.tenantId,
        settlementMonth: input.yearMonth,
        branchId: input.branchId,
        membershipId: input.membershipId,
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
    return runInTransaction(this.db, async (tx) => {
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
    return runInTransaction(this.db, async (tx) => {
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
        update: {
          policyVersionId: input.policyVersionId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          detailsJson: (input.detailsJson ?? {}) as Prisma.InputJsonValue,
        },
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

  async assessLateOccurrence(input: {
    tenantId: string;
    lateOccurrenceId: string;
    correlationId: string;
  }) {
    const late = await this.db.lateOccurrence.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.lateOccurrenceId } },
    });
    if (!late) return null;
    const policy =
      (await this.db.attendancePenaltyPolicyVersion.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: late.policyVersionId } },
      })) ??
      (await this.getEffectiveAttendancePenaltyPolicy(
        input.tenantId,
        late.branchId,
        late.businessDate,
      ));
    if (!policy) return null;
    const noticeStatus = late.lateNoticeRequestId ? 'APPROVED_ON_TIME' : 'NONE';
    const assessed = calculateLatePenalty({
      lateMinutes: late.lateMinutes,
      monthlyLateSequence: late.monthlyLateSequence,
      noticeStatus,
      policy: {
        lateFixed1To15Minor: policy.lateFixed1To15Minor,
        lateExcessPerMinuteMinor: policy.lateExcessPerMinuteMinor,
        lateExcessAfterMinutes: policy.lateExcessAfterMinutes,
        lateMaxThresholdMinutes: policy.lateMaxThresholdMinutes,
        lateMaxMinor: policy.lateMaxMinor,
        lateNoNoticeMinor: policy.lateNoNoticeMinor,
        currency: 'VND',
      },
    });
    if (!assessed) return null;
    const policySnapshotJson = {
      policyType: 'ATTENDANCE_PENALTY',
      policyVersionId: policy.id,
      policyVersionNumber: policy.versionNumber,
      lateMinutes: late.lateMinutes,
      monthlyLateSequence: late.monthlyLateSequence,
      firstLateExempt: assessed.firstLateExempt,
      noticeStatus,
      discountAmountMinor: assessed.discountAmountMinor.toString(),
    };
    await this.recordViolation({
      tenantId: late.tenantId,
      membershipId: late.membershipId,
      branchId: late.branchId,
      businessDate: late.businessDate,
      violationKind: 'LATE_BASE',
      sourceType: 'LATE_OCCURRENCE',
      sourceId: late.id,
      policyVersionId: policy.id,
      amountMinor: assessed.baseAmountMinor,
      currency: 'VND',
      detailsJson: {
        ...policySnapshotJson,
        component: 'LATE_BASE',
      },
      idempotencyKey: `late-base:${late.id}`,
      correlationId: input.correlationId,
    });
    await this.recordViolation({
      tenantId: late.tenantId,
      membershipId: late.membershipId,
      branchId: late.branchId,
      businessDate: late.businessDate,
      violationKind: 'LATE_NO_NOTICE',
      sourceType: 'LATE_OCCURRENCE',
      sourceId: late.id,
      policyVersionId: policy.id,
      amountMinor: assessed.noNoticeAmountMinor,
      currency: 'VND',
      detailsJson: {
        ...policySnapshotJson,
        component: 'LATE_NO_NOTICE',
      },
      idempotencyKey: `late-no-notice:${late.id}`,
      correlationId: input.correlationId,
    });
    return this.upsertSettlementFromViolations({
      tenantId: late.tenantId,
      membershipId: late.membershipId,
      branchId: late.branchId,
      businessDate: late.businessDate,
      settlementMonth: settlementMonth(late.businessDate),
      policySnapshotJson,
      correlationId: input.correlationId,
    });
  }

  async assessVideoReviewResult(input: {
    tenantId: string;
    videoReviewResultId: string;
    correlationId: string;
  }) {
    const review = await this.db.videoReviewResult.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.videoReviewResultId } },
    });
    if (!review || review.reviewStatus !== 'FAILED') return null;
    const event = await this.db.attendanceEvent.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: review.attendanceEventId } },
    });
    if (!event) return null;
    const policy = await this.db.videoPolicyVersion.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: event.videoPolicyVersionId } },
    });
    if (!policy || policy.videoFailedPenaltyMinor <= 0n) return null;
    const policySnapshotJson = {
      policyType: 'VIDEO',
      policyVersionId: policy.id,
      policyVersionNumber: policy.versionNumber,
      reviewStatus: review.reviewStatus,
      failedCriteria: review.failedCriteriaJson,
    };
    await this.recordViolation({
      tenantId: event.tenantId,
      membershipId: event.membershipId,
      branchId: event.branchId,
      businessDate: event.businessDate,
      violationKind: 'VIDEO_STANDARD_FAILED',
      sourceType: 'VIDEO_REVIEW_RESULT',
      sourceId: review.id,
      policyVersionId: policy.id,
      amountMinor: policy.videoFailedPenaltyMinor,
      currency: 'VND',
      detailsJson: policySnapshotJson,
      idempotencyKey: `video-review-failed:${review.id}`,
      correlationId: input.correlationId,
    });
    return this.upsertSettlementFromViolations({
      tenantId: event.tenantId,
      membershipId: event.membershipId,
      branchId: event.branchId,
      businessDate: event.businessDate,
      settlementMonth: settlementMonth(event.businessDate),
      policySnapshotJson,
      correlationId: input.correlationId,
    });
  }

  async assessMissingCheckInEvent(input: {
    tenantId: string;
    attendanceEventId: string;
    correlationId: string;
  }) {
    const event = await this.db.attendanceEvent.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.attendanceEventId } },
    });
    if (
      !event ||
      event.state !== 'MISSING_CHECK_IN' ||
      event.dayClassification !== 'NON_WORKED_NO_CHECKIN'
    ) {
      return null;
    }
    const policy = await this.db.videoPolicyVersion.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: event.videoPolicyVersionId } },
    });
    if (!policy || policy.missingCheckinPenaltyMinor <= 0n) return null;
    const policySnapshotJson = {
      policyType: 'VIDEO',
      policyVersionId: policy.id,
      policyVersionNumber: policy.versionNumber,
      reason: event.classificationReason,
    };
    await this.recordViolation({
      tenantId: event.tenantId,
      membershipId: event.membershipId,
      branchId: event.branchId,
      businessDate: event.businessDate,
      violationKind: 'MISSING_CHECK_IN',
      sourceType: 'ATTENDANCE_EVENT',
      sourceId: event.id,
      policyVersionId: policy.id,
      amountMinor: policy.missingCheckinPenaltyMinor,
      currency: 'VND',
      detailsJson: policySnapshotJson,
      idempotencyKey: `missing-checkin:${event.id}`,
      correlationId: input.correlationId,
    });
    return this.upsertSettlementFromViolations({
      tenantId: event.tenantId,
      membershipId: event.membershipId,
      branchId: event.branchId,
      businessDate: event.businessDate,
      settlementMonth: settlementMonth(event.businessDate),
      policySnapshotJson,
      correlationId: input.correlationId,
    });
  }

  async assessSuddenLeaveRequest(input: {
    tenantId: string;
    approvalRequestId: string;
    correlationId: string;
  }) {
    const request = await this.db.approvalRequest.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.approvalRequestId } },
    });
    if (!request || request.status !== 'APPROVED' || request.requestType !== 'SUDDEN_LEAVE') {
      return [];
    }
    const payload = readLeavePayload(request.payloadJson);
    if (!payload) return [];
    const dates = expandLeaveDates(payload).map((date) => new Date(`${date}T00:00:00.000Z`));
    const settlements = [];
    for (const businessDate of dates) {
      const policy = await this.getEffectiveAttendancePenaltyPolicy(
        request.tenantId,
        request.branchId,
        businessDate,
      );
      if (!policy) continue;
      const policySnapshotJson = {
        policyType: 'ATTENDANCE_PENALTY',
        policyVersionId: policy.id,
        policyVersionNumber: policy.versionNumber,
        requestType: request.requestType,
        notifiedCompanyChat: Boolean(payload.notifiedCompanyChat),
      };
      let hasViolation = false;
      if (!payload.notifiedCompanyChat) {
        await this.recordViolation({
          tenantId: request.tenantId,
          membershipId: request.requestedByMembershipId,
          branchId: request.branchId,
          businessDate,
          violationKind: 'SUDDEN_LEAVE_NO_NOTICE',
          sourceType: 'APPROVAL_REQUEST',
          sourceId: request.id,
          policyVersionId: policy.id,
          amountMinor: policy.suddenLeaveNoNoticeMinor,
          currency: 'VND',
          detailsJson: { ...policySnapshotJson, component: 'SUDDEN_LEAVE_NO_NOTICE' },
          idempotencyKey: `sudden-leave-no-notice:${request.id}:${dateKey(businessDate)}`,
          correlationId: input.correlationId,
        });
        hasViolation = true;
      }
      const sequence = await this.suddenLeaveSequenceInMonth({
        tenantId: request.tenantId,
        membershipId: request.requestedByMembershipId,
        branchId: request.branchId,
        businessDate,
      });
      if (sequence > Number(policy.monthlySuddenLeaveFreeDays.toString())) {
        await this.recordViolation({
          tenantId: request.tenantId,
          membershipId: request.requestedByMembershipId,
          branchId: request.branchId,
          businessDate,
          violationKind: 'SUDDEN_LEAVE_OVER_LIMIT',
          sourceType: 'APPROVAL_REQUEST',
          sourceId: request.id,
          policyVersionId: policy.id,
          amountMinor: policy.suddenLeaveOverLimitMinor,
          currency: 'VND',
          detailsJson: {
            ...policySnapshotJson,
            component: 'SUDDEN_LEAVE_OVER_LIMIT',
            monthlySequence: sequence,
          },
          idempotencyKey: `sudden-leave-over-limit:${request.id}:${dateKey(businessDate)}`,
          correlationId: input.correlationId,
        });
        hasViolation = true;
      }
      if (hasViolation) {
        settlements.push(
          await this.upsertSettlementFromViolations({
            tenantId: request.tenantId,
            membershipId: request.requestedByMembershipId,
            branchId: request.branchId,
            businessDate,
            settlementMonth: settlementMonth(businessDate),
            policySnapshotJson,
            correlationId: input.correlationId,
          }),
        );
      }
    }
    return settlements;
  }

  async assessLeaveRuleViolation(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    sourceType: string;
    sourceId: string;
    policyVersionId?: string;
    correlationId: string;
  }) {
    const policy = input.policyVersionId
      ? await this.db.attendancePenaltyPolicyVersion.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.policyVersionId } },
        })
      : await this.getEffectiveAttendancePenaltyPolicy(
          input.tenantId,
          input.branchId,
          input.businessDate,
        );
    if (!policy) return null;
    const policySnapshotJson = {
      policyType: 'ATTENDANCE_PENALTY',
      policyVersionId: policy.id,
      policyVersionNumber: policy.versionNumber,
      component: 'LEAVE_RULE_VIOLATION',
    };
    await this.recordViolation({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: input.branchId,
      businessDate: input.businessDate,
      violationKind: 'LEAVE_RULE_VIOLATION',
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      policyVersionId: policy.id,
      amountMinor: policy.leaveRuleViolationMinor,
      currency: 'VND',
      detailsJson: policySnapshotJson,
      idempotencyKey: `leave-rule:${input.sourceType}:${input.sourceId}:${dateKey(input.businessDate)}`,
      correlationId: input.correlationId,
    });
    return this.upsertSettlementFromViolations({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: input.branchId,
      businessDate: input.businessDate,
      settlementMonth: settlementMonth(input.businessDate),
      policySnapshotJson,
      correlationId: input.correlationId,
    });
  }

  private async suddenLeaveSequenceInMonth(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
  }) {
    const yearMonth = settlementMonth(input.businessDate);
    const monthStart = new Date(`${yearMonth}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const requests = await this.db.approvalRequest.findMany({
      where: {
        tenantId: input.tenantId,
        requestedByMembershipId: input.membershipId,
        branchId: input.branchId,
        requestType: 'SUDDEN_LEAVE',
        status: 'APPROVED',
        OR: [{ businessDate: null }, { businessDate: { lt: monthEnd } }],
      },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    });
    const dates = new Set<string>();
    for (const request of requests) {
      const payload = readLeavePayload(request.payloadJson);
      if (!payload) continue;
      for (const date of expandLeaveDates(payload)) {
        if (date.startsWith(yearMonth) && new Date(`${date}T00:00:00.000Z`) <= input.businessDate) {
          dates.add(date);
        }
      }
    }
    return dates.size;
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
    return runInTransaction(this.db, async (tx) => {
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
          eventType: 'attendance.penalty.settled',
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
    return runInTransaction(this.db, async (tx) => {
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
      assertPenaltyPaymentTransition(settlement.status, input.toStatus);
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
      const transitioned = await tx.penaltySettlement.updateMany({
        where: {
          tenantId: input.tenantId,
          id: settlement.id,
          status: settlement.status,
        },
        data: { status: input.toStatus },
      });
      if (transitioned.count !== 1) {
        throw new ProblemError(409, 'CONFLICT', 'Khoan phat da duoc xu ly boi yeu cau khac.');
      }
      const updated = await tx.penaltySettlement.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: settlement.id } },
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
          eventType: 'attendance.penalty.payment-transitioned',
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

function settlementMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readLeavePayload(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    !['FULL_DAY', 'MORNING_HALF', 'DATE_RANGE'].includes(String(payload.durationKind)) ||
    typeof payload.startDate !== 'string' ||
    typeof payload.endDate !== 'string'
  ) {
    return null;
  }
  return {
    durationKind: payload.durationKind as 'FULL_DAY' | 'MORNING_HALF' | 'DATE_RANGE',
    startDate: payload.startDate,
    endDate: payload.endDate,
    notifiedCompanyChat:
      typeof payload.notifiedCompanyChat === 'boolean' ? payload.notifiedCompanyChat : undefined,
  };
}
