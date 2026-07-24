import { describe, expect, it, vi } from 'vitest';
import { WorkflowService } from '../../src/modules/workflows/workflow-service.js';

describe('workflow routing integration harness', () => {
  it('routes through the effective branch workflow and captures leave conflict snapshots', async () => {
    const submitRequest = vi.fn(async (input: Record<string, unknown>) => ({
      id: 'request-1',
      status: 'IN_REVIEW',
      ...input,
    }));
    const validateBeforeSubmit = vi.fn(async () => ({ result: 'CLEAR' }));
    const captureSubmissionSnapshot = vi.fn(async () => undefined);
    const repository = {
      getClient: () => ({
        assignment: {
          findFirst: async () => ({
            tenantId: 'tenant-1',
            membershipId: 'member-1',
            branchId: 'branch-1',
          }),
        },
      }),
      listEffectiveDefinitions: vi.fn(async () => [
        {
          id: 'branch-workflow-v3',
          tenantId: 'tenant-1',
          scopeType: 'BRANCH',
          branchId: 'branch-1',
        },
        {
          id: 'tenant-workflow-v7',
          tenantId: 'tenant-1',
          scopeType: 'TENANT',
          branchId: null,
        },
      ]),
      submitRequest,
    };
    const service = new WorkflowService(
      repository as never,
      undefined,
      { now: () => new Date('2026-07-20T01:00:00.000Z') },
      { validateBeforeSubmit, captureSubmissionSnapshot } as never,
    );

    const request = await service.submitRequest({
      tenantId: 'tenant-1',
      actorMembershipId: 'member-1',
      correlationId: 'leave-submit',
      requestType: 'LEAVE_SCHEDULE',
      payload: {
        durationKind: 'FULL_DAY',
        startDate: '2026-07-24',
        endDate: '2026-07-24',
      },
      reason: 'Nghi co ke hoach',
      idempotencyKey: 'leave-request-1',
    });

    expect(request).toMatchObject({ workflowVersionId: 'branch-workflow-v3' });
    expect(validateBeforeSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        requestedByMembershipId: 'member-1',
        branchId: 'branch-1',
      }),
    );
    expect(captureSubmissionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalRequestId: 'request-1',
        tenantId: 'tenant-1',
        branchId: 'branch-1',
      }),
    );
  });

  it('never accepts an effective definition from another tenant', async () => {
    const repository = {
      getClient: () => ({
        assignment: {
          findFirst: async () => ({ branchId: 'branch-1' }),
        },
      }),
      listEffectiveDefinitions: async () => [],
      submitRequest: vi.fn(),
    };
    const service = new WorkflowService(repository as never, undefined, {
      now: () => new Date('2026-07-20T01:00:00.000Z'),
    });

    await expect(
      service.submitRequest({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'tenant-isolation',
        requestType: 'SHIFT_CHANGE',
        payload: {
          businessDate: '2026-07-24',
          shiftDefinitionId: '10000000-0000-4000-8000-000000000001',
        },
        reason: 'Doi ca',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'BUSINESS_RULE_VIOLATION' });
    expect(repository.submitRequest).not.toHaveBeenCalled();
  });
});
