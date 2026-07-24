import { describe, expect, it, vi } from 'vitest';
import { LeaveService } from '../../src/modules/attendance/leave-service.js';

describe('LeaveService assignment and half-day semantics', () => {
  it('assesses an idempotent leave-rule penalty before rejecting consecutive leave', async () => {
    const assessLeaveRuleViolation = vi.fn(async () => ({ id: 'settlement-1' }));
    const repository = {
      getActiveAssignments: async () => [
        { branchId: 'branch-1', departmentId: 'dept-1', positionId: 'position-1' },
      ],
      listExistingLeaveDates: async () => [{ businessDate: new Date('2026-07-23T00:00:00.000Z') }],
      listLeaveConflictCandidates: async () => [],
    };
    const service = new LeaveService(repository as never, undefined, {
      assessLeaveRuleViolation,
    } as never);

    await expect(
      service.validateBeforeSubmit({
        tenantId: 'tenant-1',
        requestType: 'LEAVE_SCHEDULE',
        requestedByMembershipId: 'member-1',
        branchId: 'branch-1',
        payload: {
          durationKind: 'FULL_DAY',
          startDate: '2026-07-24',
          endDate: '2026-07-24',
        },
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });

    expect(assessLeaveRuleViolation).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      membershipId: 'member-1',
      branchId: 'branch-1',
      businessDate: new Date('2026-07-24T00:00:00.000Z'),
      sourceType: 'MEMBERSHIP_LEAVE_RULE',
      sourceId: 'member-1',
      correlationId: 'leave-rule:member-1:2026-07-24',
    });
  });

  it('detects a conflict against every active department and position assignment', async () => {
    const repository = {
      getActiveAssignments: vi.fn(async (input: { membershipId: string }) =>
        input.membershipId === 'member-1'
          ? [
              { branchId: 'branch-1', departmentId: 'dept-1', positionId: 'position-1' },
              { branchId: 'branch-1', departmentId: 'dept-2', positionId: 'position-2' },
            ]
          : [{ branchId: 'branch-1', departmentId: 'dept-2', positionId: 'position-9' }],
      ),
      listExistingLeaveDates: async () => [],
      listLeaveConflictCandidates: async () => [
        {
          id: 'request-2',
          requestedByMembershipId: 'member-2',
          branchId: 'branch-1',
          payloadJson: {
            durationKind: 'FULL_DAY',
            startDate: '2026-07-24',
            endDate: '2026-07-24',
          },
        },
      ],
    };
    const service = new LeaveService(repository as never);

    await expect(
      service.validateBeforeSubmit({
        tenantId: 'tenant-1',
        requestType: 'LEAVE_SCHEDULE',
        requestedByMembershipId: 'member-1',
        branchId: 'branch-1',
        payload: {
          durationKind: 'FULL_DAY',
          startDate: '2026-07-24',
          endDate: '2026-07-24',
        },
      }),
    ).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
  });

  it('keeps the shift active for morning half-day leave', async () => {
    const createScheduleVersion = vi.fn(async (input: Record<string, unknown>) => ({
      id: 'schedule-2',
      ...input,
    }));
    const repository = {
      getActiveAssignments: async () => [
        { branchId: 'branch-1', departmentId: 'dept-1', positionId: 'position-1' },
      ],
      listExistingLeaveDates: async () => [],
      listLeaveConflictCandidates: async () => [],
      getEffectiveSchedule: async () => ({
        id: 'schedule-1',
        state: 'SCHEDULED',
        shiftDefinitionId: 'shift-1',
        sourceRequestId: null,
      }),
      createScheduleVersion,
      createLeaveConflictSnapshots: async () => ({ count: 1 }),
    };
    const service = new LeaveService(repository as never, {
      now: () => new Date('2026-07-23T00:00:00.000Z'),
    });

    await service.applyApprovedLeaveRequest({
      request: {
        tenantId: 'tenant-1',
        id: 'request-1',
        requestType: 'LEAVE_SCHEDULE',
        requestedByMembershipId: 'member-1',
        branchId: 'branch-1',
        status: 'APPROVED',
        payloadJson: {
          durationKind: 'MORNING_HALF',
          startDate: '2026-07-24',
          endDate: '2026-07-24',
        },
        reason: 'Morning appointment',
      },
      actorMembershipId: 'manager-1',
      correlationId: 'leave-half-day',
    });

    expect(createScheduleVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'ADJUSTED',
        shiftDefinitionId: 'shift-1',
        leaveDurationKind: 'MORNING_HALF',
        sourceRequestId: 'request-1',
      }),
    );
  });
});
