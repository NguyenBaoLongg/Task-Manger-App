import type { LeaveService } from '../attendance/leave-service.js';
import { ProblemError } from '@adsup/domain';
import type { AttendanceRepository, DatabaseTransaction, PenaltyRepository } from '@adsup/database';

export class WorkflowEffects {
  constructor(
    private readonly leaveService?: LeaveService,
    private readonly attendanceRepository?: AttendanceRepository,
    private readonly penaltyRepository?: PenaltyRepository,
  ) {}

  inTransaction(transaction: DatabaseTransaction) {
    return new WorkflowEffects(
      this.leaveService?.inTransaction(transaction),
      this.attendanceRepository?.inTransaction(transaction),
      this.penaltyRepository?.inTransaction(transaction),
    );
  }

  async applyFinalEffects(input: {
    request: {
      tenantId: string;
      id: string;
      requestType: string;
      requestedByMembershipId: string;
      branchId: string;
      businessDate?: Date | null;
      status: string;
      payloadJson: unknown;
      reason: string;
    };
    actorMembershipId: string;
    correlationId: string;
  }) {
    if (input.request.status !== 'APPROVED') return { applied: false };
    if (
      input.request.requestType === 'LEAVE_SCHEDULE' ||
      input.request.requestType === 'SUDDEN_LEAVE'
    ) {
      return this.leaveService?.applyApprovedLeaveRequest(input) ?? { applied: false };
    }
    if (input.request.requestType === 'SHIFT_CHANGE') {
      return this.applyShiftChange(input);
    }
    if (input.request.requestType === 'LATE_NOTICE') {
      return this.applyLateNotice(input);
    }
    return { applied: true };
  }

  private async applyShiftChange(input: {
    request: {
      tenantId: string;
      id: string;
      requestedByMembershipId: string;
      branchId: string;
      businessDate?: Date | null;
      payloadJson: unknown;
      reason: string;
    };
    actorMembershipId: string;
    correlationId: string;
  }) {
    if (!this.attendanceRepository) return { applied: false };
    const payload = asRecord(input.request.payloadJson);
    const businessDateString =
      typeof payload.businessDate === 'string'
        ? payload.businessDate
        : input.request.businessDate?.toISOString().slice(0, 10);
    const shiftDefinitionId =
      typeof payload.shiftDefinitionId === 'string' ? payload.shiftDefinitionId : undefined;
    if (!businessDateString || !shiftDefinitionId) return { applied: false };
    const businessDate = new Date(`${businessDateString}T00:00:00.000Z`);
    const current = await this.attendanceRepository.getEffectiveSchedule(
      input.request.tenantId,
      input.request.requestedByMembershipId,
      businessDate,
    );
    if (
      current?.sourceRequestId === input.request.id &&
      current.shiftDefinitionId === shiftDefinitionId
    ) {
      return { applied: true, effect: 'SHIFT_CHANGE', idempotent: true };
    }
    const shift = await this.attendanceRepository.getShift(
      input.request.tenantId,
      shiftDefinitionId,
    );
    if (!shift) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Khong tim thay ca lam.');
    }
    const assignments = await this.attendanceRepository.getActiveAssignments({
      tenantId: input.request.tenantId,
      membershipId: input.request.requestedByMembershipId,
      branchId: input.request.branchId,
      at: businessDate,
    });
    const assignment = assignments[0];
    if (!assignment) {
      throw new ProblemError(422, 'NO_ACTIVE_BRANCH', 'Nhan su chua co co so hieu luc.');
    }
    const schedule = await this.attendanceRepository.createScheduleVersion({
      tenantId: input.request.tenantId,
      membershipId: input.request.requestedByMembershipId,
      branchId: assignment.branchId,
      businessDate,
      shiftDefinitionId,
      state: 'SCHEDULED',
      changeKind: 'CHANGE_REQUEST',
      sourceRequestId: input.request.id,
      effectiveAt: new Date(),
      createdByMembershipId: input.actorMembershipId,
      reason: input.request.reason,
      correlationId: input.correlationId,
    });
    return { applied: true, effect: 'SHIFT_CHANGE', scheduleVersionId: schedule.id };
  }

  private async applyLateNotice(input: {
    request: {
      tenantId: string;
      id: string;
      requestedByMembershipId: string;
      businessDate?: Date | null;
      payloadJson: unknown;
    };
    correlationId: string;
  }) {
    if (!this.attendanceRepository) return { applied: false };
    const payload = asRecord(input.request.payloadJson);
    const businessDateString =
      typeof payload.businessDate === 'string'
        ? payload.businessDate
        : input.request.businessDate?.toISOString().slice(0, 10);
    if (!businessDateString) return { applied: false };
    if (payload.noticeEligibility !== 'ON_TIME') {
      return {
        applied: true,
        effect: 'LATE_NOTICE',
        eligible: false,
        linkedOccurrences: 0,
      };
    }
    const occurrences = await this.attendanceRepository.markApprovedLateNotice({
      tenantId: input.request.tenantId,
      requestId: input.request.id,
      membershipId: input.request.requestedByMembershipId,
      businessDate: new Date(`${businessDateString}T00:00:00.000Z`),
      correlationId: input.correlationId,
    });
    for (const occurrence of occurrences) {
      await this.penaltyRepository?.assessLateOccurrence({
        tenantId: input.request.tenantId,
        lateOccurrenceId: occurrence.id,
        correlationId: input.correlationId,
      });
    }
    return {
      applied: true,
      effect: 'LATE_NOTICE',
      eligible: true,
      linkedOccurrences: occurrences.length,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
