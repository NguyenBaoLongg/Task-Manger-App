import { describe, expect, it, vi } from 'vitest';
import { WorkflowEffects } from '../../src/modules/workflows/workflow-effects.js';

const approvedRequest = {
  tenantId: 'tenant-1',
  id: 'request-1',
  requestType: 'SHIFT_CHANGE',
  requestedByMembershipId: 'member-1',
  branchId: 'branch-1',
  businessDate: new Date('2026-07-21T00:00:00.000Z'),
  status: 'APPROVED',
  payloadJson: { businessDate: '2026-07-21', shiftDefinitionId: 'shift-2' },
  reason: 'Change shift',
};

describe('WorkflowEffects', () => {
  it('applies approved shift-change by creating one schedule version from the workflow request', async () => {
    const createScheduleVersion = vi.fn(async () => ({ id: 'schedule-new' }));
    const repository = {
      async getEffectiveSchedule() {
        return { id: 'schedule-old', state: 'SCHEDULED', sourceRequestId: null };
      },
      async getShift() {
        return { id: 'shift-2' };
      },
      async getActiveAssignments() {
        return [{ branchId: 'branch-1' }];
      },
      createScheduleVersion,
    };
    const effects = new WorkflowEffects(undefined, repository as never);

    await expect(
      effects.applyFinalEffects({
        request: approvedRequest,
        actorMembershipId: 'approver-1',
        correlationId: 'corr-1',
      }),
    ).resolves.toMatchObject({ applied: true, effect: 'SHIFT_CHANGE' });

    expect(createScheduleVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        membershipId: 'member-1',
        branchId: 'branch-1',
        shiftDefinitionId: 'shift-2',
        changeKind: 'CHANGE_REQUEST',
        sourceRequestId: 'request-1',
      }),
    );
  });

  it('links approved late notice to late occurrences and asks penalty assessment to recompute', async () => {
    const markApprovedLateNotice = vi.fn(async () => [{ id: 'late-1' }, { id: 'late-2' }]);
    const assessLateOccurrence = vi.fn(async () => ({ id: 'settlement-1' }));
    const effects = new WorkflowEffects(
      undefined,
      { markApprovedLateNotice } as never,
      { assessLateOccurrence } as never,
    );

    await expect(
      effects.applyFinalEffects({
        request: {
          ...approvedRequest,
          requestType: 'LATE_NOTICE',
          payloadJson: {
            businessDate: '2026-07-21',
            notifiedAt: '2026-07-21T00:45:00.000Z',
            noticeEligibility: 'ON_TIME',
          },
        },
        actorMembershipId: 'approver-1',
        correlationId: 'corr-2',
      }),
    ).resolves.toMatchObject({ applied: true, effect: 'LATE_NOTICE', linkedOccurrences: 2 });

    expect(markApprovedLateNotice).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'request-1', membershipId: 'member-1' }),
    );
    expect(assessLateOccurrence).toHaveBeenCalledTimes(2);
  });

  it('does not discount an approved late notice submitted after the deadline', async () => {
    const markApprovedLateNotice = vi.fn(async () => []);
    const assessLateOccurrence = vi.fn();
    const effects = new WorkflowEffects(
      undefined,
      { markApprovedLateNotice } as never,
      { assessLateOccurrence } as never,
    );

    await expect(
      effects.applyFinalEffects({
        request: {
          ...approvedRequest,
          requestType: 'LATE_NOTICE',
          payloadJson: {
            businessDate: '2026-07-21',
            notifiedAt: '2026-07-21T01:01:00.000Z',
            noticeDeadlineAt: '2026-07-21T01:00:00.000Z',
            noticeEligibility: 'LATE',
          },
        },
        actorMembershipId: 'approver-1',
        correlationId: 'corr-late',
      }),
    ).resolves.toMatchObject({ applied: true, effect: 'LATE_NOTICE', eligible: false });

    expect(markApprovedLateNotice).not.toHaveBeenCalled();
    expect(assessLateOccurrence).not.toHaveBeenCalled();
  });
});
