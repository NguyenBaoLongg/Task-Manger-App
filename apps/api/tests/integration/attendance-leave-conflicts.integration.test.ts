import { describe, expect, it, vi } from 'vitest';
import { LeaveService } from '../../src/modules/attendance/leave-service.js';

describe('attendance leave conflict integration harness', () => {
  it('checks every active assignment and persists one clear snapshot per assignment', async () => {
    const createLeaveConflictSnapshots = vi.fn(async () => ({ count: 1 }));
    const repository = {
      getActiveAssignments: async (input: { membershipId: string }) =>
        input.membershipId === 'member-1'
          ? [
              { branchId: 'branch-1', departmentId: 'dept-1', positionId: 'position-1' },
              { branchId: 'branch-1', departmentId: 'dept-2', positionId: 'position-2' },
            ]
          : [],
      listExistingLeaveDates: async () => [],
      listLeaveConflictCandidates: async () => [],
      createLeaveConflictSnapshots,
    };
    const service = new LeaveService(repository as never);

    await service.captureSubmissionSnapshot({
      tenantId: 'tenant-1',
      approvalRequestId: 'request-1',
      requestType: 'LEAVE_SCHEDULE',
      requestedByMembershipId: 'member-1',
      branchId: 'branch-1',
      payload: {
        durationKind: 'DATE_RANGE',
        startDate: '2026-07-30',
        endDate: '2026-08-01',
        exceptionEvidence: { mediaObjectId: 'evidence-1' },
      },
    });

    expect(createLeaveConflictSnapshots).toHaveBeenCalledTimes(2);
    expect(createLeaveConflictSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        approvalRequestId: 'request-1',
        departmentId: 'dept-2',
        positionId: 'position-2',
        dates: [
          new Date('2026-07-30T00:00:00.000Z'),
          new Date('2026-07-31T00:00:00.000Z'),
          new Date('2026-08-01T00:00:00.000Z'),
        ],
        result: 'CLEAR',
      }),
    );
  });

  it('blocks a conflict found through a secondary assignment', async () => {
    const repository = {
      getActiveAssignments: async (input: { membershipId: string }) =>
        input.membershipId === 'member-1'
          ? [
              { branchId: 'branch-1', departmentId: 'dept-1', positionId: 'position-1' },
              { branchId: 'branch-1', departmentId: 'dept-2', positionId: 'position-2' },
            ]
          : [{ branchId: 'branch-1', departmentId: 'dept-2', positionId: 'position-9' }],
      listExistingLeaveDates: async () => [],
      listLeaveConflictCandidates: async () => [
        {
          id: 'request-existing',
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
    ).rejects.toMatchObject({ status: 422, code: 'BUSINESS_RULE_VIOLATION' });
  });
});
