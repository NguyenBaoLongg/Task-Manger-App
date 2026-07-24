import { describe, expect, it, vi } from 'vitest';
import { WorkflowRepository, type DatabaseClient } from '@adsup/database';
import type { WorkflowStepTemplate } from '@adsup/domain';

const request = {
  tenantId: 'tenant-1',
  id: 'request-1',
  requestType: 'SHIFT_CHANGE',
  requestedByMembershipId: 'employee-1',
  branchId: 'branch-1',
  businessDate: new Date('2026-07-24T00:00:00.000Z'),
  scheduleVersionId: null,
  workflowVersionId: 'workflow-1',
  status: 'IN_REVIEW',
  payloadJson: { businessDate: '2026-07-24', shiftDefinitionId: 'shift-2' },
  reason: 'Change shift',
};

interface OutboxUpsertInput {
  create: { eventType: string };
}

function repositoryWithStep(step: WorkflowStepTemplate) {
  const activeStep = {
    tenantId: 'tenant-1',
    id: 'step-1',
    approvalRequestId: 'request-1',
    stepOrder: 1,
    mode: 'SEQUENTIAL',
    requiredApprovalCount: 1,
    status: 'ACTIVE',
  };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'request-1' }]),
    approvalRequest: {
      findUniqueOrThrow: vi.fn(async () => request),
      update: vi.fn(async () => ({ ...request, status: 'APPROVED', resolvedAt: new Date() })),
    },
    approvalRunStep: {
      findFirst: vi.fn(async () => activeStep),
      findMany: vi.fn(async () => [activeStep]),
      update: vi.fn(async () => activeStep),
    },
    workflowDefinitionVersion: {
      findUniqueOrThrow: vi.fn(async () => ({ stepsJson: [step] })),
    },
    tenantMembership: {
      findUnique: vi.fn(async () => ({ id: 'denied-approver', status: 'ACTIVE' })),
    },
    approvalDecisionRecord: {
      findFirst: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ id: 'decision-1' })),
      count: vi.fn(async () => 1),
    },
    outboxEvent: {
      upsert: vi.fn(async (_input: OutboxUpsertInput) => ({ id: 'event-1' })),
    },
    actionItem: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  type TxHarness = typeof tx;
  const transaction = vi.fn(async <T>(callback: (transactionClient: TxHarness) => Promise<T>) =>
    callback(tx),
  );
  return {
    tx,
    repository: new WorkflowRepository({
      $transaction: transaction,
    } as unknown as DatabaseClient),
  };
}

describe('workflow tenant and approver isolation integration harness', () => {
  it('denies a decision from an actor outside the explicit approver set', async () => {
    const { tx, repository } = repositoryWithStep({
      mode: 'SEQUENTIAL',
      approverRule: 'EXPLICIT_MEMBERS',
      memberIds: ['allowed-approver'],
      requiredApprovalCount: 1,
    });

    await expect(
      repository.recordDecision({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        approverMembershipId: 'denied-approver',
        decision: 'APPROVE',
        reason: 'Not allowed',
        idempotencyKey: 'decision-1',
        correlationId: 'corr-1',
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });

    expect(tx.approvalDecisionRecord.upsert).not.toHaveBeenCalled();
  });

  it('records contract-aligned decision and resolved events for an eligible approver', async () => {
    const { tx, repository } = repositoryWithStep({
      mode: 'SEQUENTIAL',
      approverRule: 'EXPLICIT_MEMBERS',
      memberIds: ['allowed-approver'],
      requiredApprovalCount: 1,
    });
    tx.tenantMembership.findUnique.mockResolvedValue({ id: 'allowed-approver', status: 'ACTIVE' });

    await expect(
      repository.recordDecision({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        approverMembershipId: 'allowed-approver',
        decision: 'APPROVE',
        reason: 'Approved',
        idempotencyKey: 'decision-2',
        correlationId: 'corr-2',
      }),
    ).resolves.toMatchObject({ status: 'APPROVED' });

    const eventTypes = tx.outboxEvent.upsert.mock.calls.map(([input]) => input.create.eventType);
    expect(eventTypes).toContain('workflow.decision.recorded');
    expect(eventTypes).toContain('workflow.request.resolved');
  });
});
