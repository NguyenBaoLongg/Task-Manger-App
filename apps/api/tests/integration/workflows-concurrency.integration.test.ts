import { describe, expect, it } from 'vitest';
import { WorkflowRepository } from '@adsup/database';
import { WorkflowService } from '../../src/modules/workflows/workflow-service.js';

type RequestStatus = 'IN_REVIEW' | 'APPROVED';

interface HarnessState {
  request: {
    tenantId: string;
    id: string;
    requestType: 'SHIFT_CHANGE';
    requestedByMembershipId: string;
    branchId: string;
    businessDate: Date;
    workflowVersionId: string;
    status: RequestStatus;
    payloadJson: Record<string, unknown>;
    reason: string;
    resolvedAt: Date | null;
  };
  step: {
    tenantId: string;
    id: string;
    approvalRequestId: string;
    stepOrder: number;
    mode: 'SEQUENTIAL';
    requiredApprovalCount: number;
    status: 'ACTIVE' | 'COMPLETED';
    activatedAt: Date | null;
    completedAt: Date | null;
  };
  decisions: Array<{
    tenantId: string;
    approvalRequestId: string;
    stepId: string;
    approverMembershipId: string;
    decision: 'APPROVE';
    reason: string;
    idempotencyKey: string;
  }>;
  outbox: Map<string, { eventType: string }>;
}

function createHarness() {
  let state: HarnessState = {
    request: {
      tenantId: 'tenant-1',
      id: 'request-1',
      requestType: 'SHIFT_CHANGE',
      requestedByMembershipId: 'employee-1',
      branchId: 'branch-1',
      businessDate: new Date('2026-07-21T00:00:00.000Z'),
      workflowVersionId: 'workflow-1',
      status: 'IN_REVIEW',
      payloadJson: { businessDate: '2026-07-21', shiftDefinitionId: 'shift-2' },
      reason: 'Change shift',
      resolvedAt: null,
    },
    step: {
      tenantId: 'tenant-1',
      id: 'step-1',
      approvalRequestId: 'request-1',
      stepOrder: 1,
      mode: 'SEQUENTIAL',
      requiredApprovalCount: 1,
      status: 'ACTIVE',
      activatedAt: new Date('2026-07-21T01:00:00.000Z'),
      completedAt: null,
    },
    decisions: [],
    outbox: new Map(),
  };
  let transactionTail = Promise.resolve();

  const transactionClient = {
    $queryRaw: async () => [{ id: state.request.id }],
    approvalRequest: {
      findUniqueOrThrow: async () => ({ ...state.request }),
      update: async (input: { data: { status: RequestStatus; resolvedAt: Date | null } }) => {
        state.request = { ...state.request, ...input.data };
        return { ...state.request };
      },
    },
    approvalRunStep: {
      findFirst: async () => (state.step.status === 'ACTIVE' ? { ...state.step } : null),
      findMany: async () => [{ ...state.step }],
      update: async (input: {
        data: {
          status: 'ACTIVE' | 'COMPLETED';
          activatedAt?: Date;
          completedAt?: Date;
        };
      }) => {
        state.step = { ...state.step, ...input.data };
        return { ...state.step };
      },
    },
    workflowDefinitionVersion: {
      findUniqueOrThrow: async () => ({
        id: 'workflow-1',
        stepsJson: [
          {
            mode: 'SEQUENTIAL',
            requiredApprovalCount: 1,
            approverRule: 'EXPLICIT_MEMBERS',
            memberIds: ['approver-1'],
          },
        ],
      }),
    },
    tenantMembership: {
      findUnique: async () => ({ id: 'approver-1', status: 'ACTIVE' }),
    },
    approvalDecisionRecord: {
      findFirst: async () =>
        state.decisions.find((decision) => decision.approverMembershipId === 'approver-1') ?? null,
      upsert: async (input: { create: HarnessState['decisions'][number] }) => {
        const existing = state.decisions.find(
          (decision) =>
            decision.approverMembershipId === input.create.approverMembershipId &&
            decision.idempotencyKey === input.create.idempotencyKey,
        );
        if (existing) return existing;
        state.decisions.push(input.create);
        return input.create;
      },
      count: async () =>
        state.decisions.filter((decision) => decision.decision === 'APPROVE').length,
    },
    outboxEvent: {
      upsert: async (input: {
        where: { tenantId_dedupeKey: { dedupeKey: string } };
        create: { eventType: string };
      }) => {
        state.outbox.set(input.where.tenantId_dedupeKey.dedupeKey, {
          eventType: input.create.eventType,
        });
        return input.create;
      },
    },
    actionItem: {
      updateMany: async () => ({ count: 1 }),
    },
  };

  const database = {
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) => {
      let release: () => void = () => {};
      const previous = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const snapshot = structuredClone(state);
      try {
        return await operation(transactionClient);
      } catch (error) {
        state = snapshot;
        throw error;
      } finally {
        release();
      }
    },
  };

  return {
    repository: new WorkflowRepository(database as never),
    getState: () => state,
  };
}

describe('workflow decision concurrency integration', () => {
  it('serializes 100 concurrent decisions and applies the final effect exactly once', async () => {
    const harness = createHarness();
    let effectCount = 0;
    const service = new WorkflowService(harness.repository, {
      inTransaction: () => ({
        applyFinalEffects: async () => {
          effectCount += 1;
        },
      }),
    } as never);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        service.decide({
          tenantId: 'tenant-1',
          requestId: 'request-1',
          actorMembershipId: 'approver-1',
          correlationId: `decision-${index}`,
          decision: 'APPROVE',
          reason: 'Approved',
          idempotencyKey: `decision-key-${index}`,
        }),
      ),
    );

    expect(results.every((request) => request.status === 'APPROVED')).toBe(true);
    expect(harness.getState().decisions).toHaveLength(1);
    expect(effectCount).toBe(1);
    expect(
      [...harness.getState().outbox.values()].filter(
        (event) => event.eventType === 'workflow.request.resolved',
      ),
    ).toHaveLength(1);
  });

  it('rolls back the decision, status and outbox when the final effect fails', async () => {
    const harness = createHarness();
    const service = new WorkflowService(harness.repository, {
      inTransaction: () => ({
        applyFinalEffects: async () => {
          throw new Error('effect failed');
        },
      }),
    } as never);

    await expect(
      service.decide({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        actorMembershipId: 'approver-1',
        correlationId: 'failed-decision',
        decision: 'APPROVE',
        reason: 'Approved',
      }),
    ).rejects.toThrow('effect failed');

    expect(harness.getState().request.status).toBe('IN_REVIEW');
    expect(harness.getState().step.status).toBe('ACTIVE');
    expect(harness.getState().decisions).toHaveLength(0);
    expect(harness.getState().outbox.size).toBe(0);
  });
});
