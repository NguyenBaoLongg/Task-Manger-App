import {
  ProblemError,
  evaluateConsecutiveLeaveRule,
  expandLeaveDates,
  findLeaveConflict,
  formatBusinessDate,
  parseBusinessDate,
  systemClock,
  type Clock,
} from '@adsup/domain';
import type { AttendanceRepository, DatabaseTransaction, PenaltyRepository } from '@adsup/database';

type LeaveRequestType = 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
type LeaveDurationKind = 'FULL_DAY' | 'MORNING_HALF' | 'DATE_RANGE';

export interface LeavePayload {
  durationKind: LeaveDurationKind;
  startDate: string;
  endDate: string;
  notifiedCompanyChat?: boolean;
  exceptionEvidence?: unknown;
}

export class LeaveService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly clock: Clock = systemClock,
    private readonly penalties?: PenaltyRepository,
  ) {}

  inTransaction(transaction: DatabaseTransaction) {
    return new LeaveService(
      this.repository.inTransaction(transaction),
      this.clock,
      this.penalties?.inTransaction(transaction),
    );
  }

  async validateBeforeSubmit(input: {
    tenantId: string;
    requestType: string;
    requestedByMembershipId: string;
    branchId: string;
    payload: Record<string, unknown>;
    excludeRequestId?: string;
  }) {
    if (!isLeaveType(input.requestType)) return null;
    const payload = readLeavePayload(input.payload);
    const dates = expandLeaveDates(payload);
    const assignments = await this.repository.getActiveAssignments({
      tenantId: input.tenantId,
      membershipId: input.requestedByMembershipId,
      branchId: input.branchId,
      at: parseBusinessDate(dates[0]!),
    });
    if (!assignments.length) {
      throw new ProblemError(
        422,
        'NO_ACTIVE_BRANCH',
        'Nhan su chua co co so hieu luc cho ngay nghi.',
      );
    }
    const adjacentFrom = parseBusinessDate(dates[0]!);
    adjacentFrom.setUTCDate(adjacentFrom.getUTCDate() - 1);
    const adjacentTo = parseBusinessDate(dates[dates.length - 1]!);
    adjacentTo.setUTCDate(adjacentTo.getUTCDate() + 1);
    const existingLeaveDates = await this.repository.listExistingLeaveDates({
      tenantId: input.tenantId,
      membershipId: input.requestedByMembershipId,
      dateFrom: adjacentFrom,
      dateTo: adjacentTo,
    });
    const consecutive = evaluateConsecutiveLeaveRule({
      requestedDates: dates,
      existingLeaveDates: existingLeaveDates.map((item) => formatBusinessDate(item.businessDate)),
      hasApprovedException: Boolean(payload.exceptionEvidence),
    });
    if (!consecutive.allowed) {
      const violationDate = parseBusinessDate(dates[0]!);
      await this.penalties?.assessLeaveRuleViolation({
        tenantId: input.tenantId,
        membershipId: input.requestedByMembershipId,
        branchId: input.branchId,
        businessDate: violationDate,
        sourceType: 'MEMBERSHIP_LEAVE_RULE',
        sourceId: input.requestedByMembershipId,
        correlationId: `leave-rule:${input.requestedByMembershipId}:${dates[0]}`,
      });
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Ngay nghi lien tiep can ngoai le hop le.',
        {
          violationKind: 'LEAVE_RULE_VIOLATION',
        },
      );
    }
    const conflict = await this.detectConflict({
      tenantId: input.tenantId,
      requestType: input.requestType,
      requestedByMembershipId: input.requestedByMembershipId,
      branchId: input.branchId,
      assignments: assignments.map((assignment) => ({
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
      })),
      dates,
      excludeRequestId: input.excludeRequestId,
    });
    if (conflict.result === 'CONFLICT') {
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Lich nghi bi trung voi nhan su cung co so/vi tri.',
        conflict,
      );
    }
    return {
      payload,
      dates,
      businessDate: parseBusinessDate(dates[0]!),
      assignments,
    };
  }

  async captureSubmissionSnapshot(input: {
    tenantId: string;
    approvalRequestId: string;
    requestType: string;
    requestedByMembershipId: string;
    branchId: string;
    payload: Record<string, unknown>;
  }) {
    if (!isLeaveType(input.requestType)) return;
    const checked = await this.validateBeforeSubmit(input);
    if (!checked) return;
    for (const assignment of checked.assignments) {
      await this.repository.createLeaveConflictSnapshots({
        tenantId: input.tenantId,
        approvalRequestId: input.approvalRequestId,
        branchId: input.branchId,
        dates: checked.dates.map(parseBusinessDate),
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
        result: 'CLEAR',
      });
    }
  }

  async applyApprovedLeaveRequest(input: {
    request: {
      tenantId: string;
      id: string;
      requestType: string;
      requestedByMembershipId: string;
      branchId: string;
      status: string;
      payloadJson: unknown;
      reason: string;
    };
    actorMembershipId: string;
    correlationId: string;
  }) {
    if (input.request.status !== 'APPROVED' || !isLeaveType(input.request.requestType)) {
      return { applied: false };
    }
    const payload = readLeavePayload(asRecord(input.request.payloadJson));
    const checked = await this.validateBeforeSubmit({
      tenantId: input.request.tenantId,
      requestType: input.request.requestType,
      requestedByMembershipId: input.request.requestedByMembershipId,
      branchId: input.request.branchId,
      payload: asRecord(input.request.payloadJson),
      excludeRequestId: input.request.id,
    });
    if (!checked) return { applied: false };

    let applied = 0;
    for (const businessDateString of checked.dates) {
      const businessDate = parseBusinessDate(businessDateString);
      const current = await this.repository.getEffectiveSchedule(
        input.request.tenantId,
        input.request.requestedByMembershipId,
        businessDate,
      );
      if (
        current?.sourceRequestId === input.request.id &&
        current.leaveDurationKind === payload.durationKind
      ) {
        continue;
      }
      const assignments = await this.repository.getActiveAssignments({
        tenantId: input.request.tenantId,
        membershipId: input.request.requestedByMembershipId,
        branchId: input.request.branchId,
        at: businessDate,
      });
      const assignment = assignments[0];
      if (!assignment) {
        throw new ProblemError(
          422,
          'NO_ACTIVE_BRANCH',
          'Nhan su chua co co so hieu luc cho ngay nghi.',
        );
      }
      const isMorningHalf = payload.durationKind === 'MORNING_HALF';
      if (isMorningHalf && !current?.shiftDefinitionId) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Nghi buoi sang can mot ca lam hieu luc.',
        );
      }
      await this.repository.createScheduleVersion({
        tenantId: input.request.tenantId,
        membershipId: input.request.requestedByMembershipId,
        branchId: assignment.branchId,
        businessDate,
        shiftDefinitionId: isMorningHalf ? current!.shiftDefinitionId : null,
        state: isMorningHalf ? 'ADJUSTED' : 'LEAVE_APPROVED',
        leaveDurationKind: payload.durationKind,
        changeKind: 'LEAVE_APPROVAL',
        sourceRequestId: input.request.id,
        effectiveAt: this.clock.now(),
        createdByMembershipId: input.actorMembershipId,
        reason: input.request.reason,
        correlationId: input.correlationId,
      });
      applied += 1;
    }
    for (const assignment of checked.assignments) {
      await this.repository.createLeaveConflictSnapshots({
        tenantId: input.request.tenantId,
        approvalRequestId: input.request.id,
        branchId: input.request.branchId,
        dates: checked.dates.map(parseBusinessDate),
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
        result: 'CLEAR',
      });
    }
    if (input.request.requestType === 'SUDDEN_LEAVE') {
      await this.penalties?.assessSuddenLeaveRequest({
        tenantId: input.request.tenantId,
        approvalRequestId: input.request.id,
        correlationId: input.correlationId,
      });
    }
    return {
      applied: true,
      dates: checked.dates,
      appliedSchedules: applied,
      durationKind: payload.durationKind,
    };
  }

  private async detectConflict(input: {
    tenantId: string;
    requestType: string;
    requestedByMembershipId: string;
    branchId: string;
    assignments: Array<{ departmentId?: string | null; positionId?: string | null }>;
    dates: string[];
    excludeRequestId?: string;
  }) {
    const candidates = await this.repository.listLeaveConflictCandidates({
      tenantId: input.tenantId,
      branchId: input.branchId,
      dateFrom: parseBusinessDate(input.dates[0]!),
      dateTo: parseBusinessDate(input.dates[input.dates.length - 1]!),
      excludeRequestId: input.excludeRequestId,
      excludeMembershipId: input.requestedByMembershipId,
    });
    const existing = [];
    for (const candidate of candidates) {
      const payload = readLeavePayload(asRecord(candidate.payloadJson));
      const candidateDates = expandLeaveDates(payload);
      const assignments = await this.repository.getActiveAssignments({
        tenantId: input.tenantId,
        membershipId: candidate.requestedByMembershipId,
        branchId: candidate.branchId,
        at: parseBusinessDate(candidateDates[0]!),
      });
      for (const assignment of assignments) {
        existing.push({
          requestId: candidate.id,
          membershipId: candidate.requestedByMembershipId,
          branchId: candidate.branchId,
          departmentId: assignment.departmentId,
          positionId: assignment.positionId,
          dates: candidateDates,
        });
      }
    }
    for (const assignment of input.assignments) {
      const conflict = findLeaveConflict({
        request: {
          membershipId: input.requestedByMembershipId,
          branchId: input.branchId,
          departmentId: assignment.departmentId,
          positionId: assignment.positionId,
          dates: input.dates,
        },
        existing,
      });
      if (conflict.result === 'CONFLICT') return conflict;
    }
    return { result: 'CLEAR' as const };
  }
}

export class AbsenceService {
  constructor(private readonly repository: AttendanceRepository) {}

  async listMonthlySummaries(input: {
    tenantId: string;
    yearMonth: string;
    branchId?: string;
    overThreshold?: boolean;
  }) {
    const items = await this.repository.listMonthlyAbsenceSummaries(input);
    return {
      items: items.map((item) => ({
        ...item,
        approvedAbsenceDays: item.approvedAbsenceDaysDecimal.toString(),
        suddenLeaveDays: item.suddenLeaveDaysDecimal.toString(),
      })),
      pageInfo: { nextCursor: null },
    };
  }
}

function isLeaveType(value: string): value is LeaveRequestType {
  return value === 'LEAVE_SCHEDULE' || value === 'SUDDEN_LEAVE';
}

function readLeavePayload(value: Record<string, unknown>): LeavePayload {
  const payload = value;
  if (
    !['FULL_DAY', 'MORNING_HALF', 'DATE_RANGE'].includes(String(payload.durationKind)) ||
    typeof payload.startDate !== 'string' ||
    typeof payload.endDate !== 'string'
  ) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Du lieu don nghi khong hop le.');
  }
  if (String(payload.endDate) < String(payload.startDate)) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Khoang ngay nghi khong hop le.');
  }
  if (payload.durationKind === 'MORNING_HALF' && payload.startDate !== payload.endDate) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Nghi buoi sang chi ap dung cho mot ngay.');
  }
  return {
    durationKind: payload.durationKind as LeaveDurationKind,
    startDate: payload.startDate,
    endDate: payload.endDate,
    notifiedCompanyChat:
      typeof payload.notifiedCompanyChat === 'boolean' ? payload.notifiedCompanyChat : undefined,
    exceptionEvidence: payload.exceptionEvidence,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
