import { describe, expect, it, vi } from 'vitest';
import { WorkflowService } from '../../src/modules/workflows/workflow-service.js';

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

describe('WorkflowService decision transaction boundary', () => {
  it('applies final effects through the repository transaction callback', async () => {
    const transaction = { transaction: true };
    const applyFinalEffects = vi.fn(async () => ({ applied: true }));
    const inTransaction = vi.fn(() => ({ applyFinalEffects }));
    const outsideApplyFinalEffects = vi.fn();
    const recordDecision = vi.fn(
      async (
        _input: unknown,
        applyEffect: (input: {
          request: typeof approvedRequest;
          transaction: unknown;
        }) => Promise<void>,
      ) => {
        await applyEffect({ request: approvedRequest, transaction });
        return approvedRequest;
      },
    );
    const service = new WorkflowService(
      { recordDecision } as never,
      { inTransaction, applyFinalEffects: outsideApplyFinalEffects } as never,
    );

    await expect(
      service.decide({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        actorMembershipId: 'approver-1',
        correlationId: 'correlation-1',
        decision: 'APPROVE',
        reason: 'Approved',
        idempotencyKey: 'decision-key-1',
      }),
    ).resolves.toEqual(approvedRequest);

    expect(inTransaction).toHaveBeenCalledWith(transaction);
    expect(applyFinalEffects).toHaveBeenCalledWith({
      request: approvedRequest,
      actorMembershipId: 'approver-1',
      correlationId: 'correlation-1',
    });
    expect(outsideApplyFinalEffects).not.toHaveBeenCalled();
  });

  it.each([
    ['2026-07-21T00:59:00.000Z', 'ON_TIME'],
    ['2026-07-21T01:00:01.000Z', 'LATE'],
  ] as const)(
    'snapshots backend-authoritative late notice eligibility at %s',
    async (now, expectedEligibility) => {
      const submitRequest = vi.fn(async (input: { payloadJson: Record<string, unknown> }) => ({
        id: 'request-late',
        ...input,
      }));
      const repository = {
        getClient: () => ({
          assignment: {
            findFirst: async () => ({ branchId: 'branch-1' }),
          },
          workScheduleVersion: {
            findFirst: async () => ({
              id: 'schedule-1',
              shiftDefinitionId: 'shift-1',
              branchId: 'branch-1',
            }),
          },
          shiftDefinition: {
            findUnique: async () => ({
              id: 'shift-1',
              startLocalTime: '08:30',
              timezone: 'Asia/Ho_Chi_Minh',
            }),
          },
        }),
        listEffectiveDefinitions: async () => [{ id: 'workflow-1' }],
        submitRequest,
      };
      const service = new WorkflowService(repository as never, undefined, {
        now: () => new Date(now),
      });

      await service.submitRequest({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'late-notice-submit',
        requestType: 'LATE_NOTICE',
        payload: {
          businessDate: '2026-07-21',
          notifiedAt: '2026-07-20T00:00:00.000Z',
        },
        reason: 'Traffic delay',
      });

      expect(submitRequest.mock.calls[0]?.[0].payloadJson).toMatchObject({
        businessDate: '2026-07-21',
        notifiedAt: now,
        noticeDeadlineAt: '2026-07-21T01:00:00.000Z',
        noticeEligibility: expectedEligibility,
      });
    },
  );

  it('propagates a final-effect failure so the repository transaction can roll back', async () => {
    const failure = new Error('schedule effect failed');
    const recordDecision = vi.fn(
      async (
        _input: unknown,
        applyEffect: (input: {
          request: typeof approvedRequest;
          transaction: unknown;
        }) => Promise<void>,
      ) => {
        await applyEffect({ request: approvedRequest, transaction: {} });
        return approvedRequest;
      },
    );
    const service = new WorkflowService(
      { recordDecision } as never,
      {
        inTransaction: () => ({
          applyFinalEffects: vi.fn(async () => {
            throw failure;
          }),
        }),
      } as never,
    );

    await expect(
      service.decide({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        actorMembershipId: 'approver-1',
        correlationId: 'correlation-2',
        decision: 'APPROVE',
        reason: 'Approved',
      }),
    ).rejects.toBe(failure);
  });
});
