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
import type { AttendanceRepository } from '@adsup/database';

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
  ) {}

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
    const assignment = assignments[0];
    if (!assignment) {
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
      departmentId: assignment.departmentId,
      positionId: assignment.positionId,
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
      departmentId: assignment.departmentId,
      positionId: assignment.positionId,
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
    await this.repository.createLeaveConflictSnapshots({
      tenantId: input.tenantId,
      approvalRequestId: input.approvalRequestId,
      branchId: input.branchId,
      dates: checked.dates.map(parseBusinessDate),
      departmentId: checked.departmentId,
      positionId: checked.positionId,
      result: 'CLEAR',
    });
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
      if (current?.sourceRequestId === input.request.id && current.state === 'LEAVE_APPROVED') {
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
      await this.repository.createScheduleVersion({
        tenantId: input.request.tenantId,
        membershipId: input.request.requestedByMembershipId,
        branchId: assignment.branchId,
        businessDate,
        shiftDefinitionId: null,
        state: 'LEAVE_APPROVED',
        changeKind: 'LEAVE_APPROVAL',
        sourceRequestId: input.request.id,
        effectiveAt: this.clock.now(),
        createdByMembershipId: input.actorMembershipId,
        reason: input.request.reason,
        correlationId: input.correlationId,
      });
      applied += 1;
    }
    await this.repository.createLeaveConflictSnapshots({
      tenantId: input.request.tenantId,
      approvalRequestId: input.request.id,
      branchId: input.request.branchId,
      dates: checked.dates.map(parseBusinessDate),
      departmentId: checked.departmentId,
      positionId: checked.positionId,
      result: 'CLEAR',
    });
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
    departmentId?: string | null;
    positionId?: string | null;
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
      const assignment = assignments[0];
      existing.push({
        requestId: candidate.id,
        membershipId: candidate.requestedByMembershipId,
        branchId: candidate.branchId,
        departmentId: assignment?.departmentId,
        positionId: assignment?.positionId,
        dates: candidateDates,
      });
    }
    return findLeaveConflict({
      request: {
        membershipId: input.requestedByMembershipId,
        branchId: input.branchId,
        departmentId: input.departmentId,
        positionId: input.positionId,
        dates: input.dates,
      },
      existing,
    });
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
