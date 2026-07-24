import type { DatabaseClient, DatabaseTransaction } from './client.js';
import {
  applyApprovalDecision,
  createInitialRunSteps,
  ProblemError,
  type WorkflowStepTemplate,
} from '@adsup/domain';
import type { Prisma } from './generated/prisma/client.js';

export type WorkflowFinalEffect = (input: {
  transaction: DatabaseTransaction;
  request: {
    tenantId: string;
    id: string;
    requestType: string;
    requestedByMembershipId: string;
    branchId: string;
    businessDate: Date | null;
    status: string;
    payloadJson: Prisma.JsonValue;
    reason: string;
  };
}) => Promise<void>;

export class WorkflowRepository {
  constructor(private readonly db: DatabaseClient) {}

  listEffectiveDefinitions(input: {
    tenantId: string;
    requestType?: 'SHIFT_CHANGE' | 'LATE_NOTICE' | 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
    branchId?: string | null;
    businessDate: Date;
  }) {
    return this.db.workflowDefinitionVersion.findMany({
      where: {
        tenantId: input.tenantId,
        requestType: input.requestType,
        effectiveFromDate: { lte: input.businessDate },
        OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: input.businessDate } }],
        AND: [{ OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId: input.branchId }] }],
      },
      orderBy: [{ scopeType: 'desc' }, { versionNumber: 'desc' }, { id: 'desc' }],
    });
  }

  getRequest(tenantId: string, id: string) {
    return this.db.approvalRequest.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  async createDefinitionVersion(input: {
    tenantId: string;
    requestType: 'SHIFT_CHANGE' | 'LATE_NOTICE' | 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string | null;
    effectiveFromDate: Date;
    effectiveToDate?: Date | null;
    steps: WorkflowStepTemplate[];
    parallelRuleJson?: Record<string, unknown>;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const latest = await tx.workflowDefinitionVersion.findFirst({
        where: {
          tenantId: input.tenantId,
          requestType: input.requestType,
          scopeType: input.scopeType,
          branchId: input.branchId ?? null,
        },
        orderBy: { versionNumber: 'desc' },
      });
      const definition = await tx.workflowDefinitionVersion.create({
        data: {
          tenantId: input.tenantId,
          requestType: input.requestType,
          scopeType: input.scopeType,
          branchId: input.branchId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          effectiveFromDate: input.effectiveFromDate,
          effectiveToDate: input.effectiveToDate,
          stepsJson: input.steps as unknown as Prisma.InputJsonValue,
          parallelRuleJson: (input.parallelRuleJson ?? {}) as Prisma.InputJsonValue,
          createdByMembershipId: input.actorMembershipId,
          reason: input.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'WORKFLOW_DEFINITION_VERSION_CREATED',
          targetType: 'WORKFLOW_DEFINITION_VERSION',
          targetId: definition.id,
          reason: input.reason,
          afterRedacted: {
            requestType: definition.requestType,
            scopeType: definition.scopeType,
            versionNumber: definition.versionNumber,
          },
        },
      });
      return definition;
    });
  }

  async submitRequest(input: {
    tenantId: string;
    requestType: 'SHIFT_CHANGE' | 'LATE_NOTICE' | 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
    requestedByMembershipId: string;
    branchId: string;
    businessDate?: Date | null;
    scheduleVersionId?: string | null;
    workflowVersionId: string;
    payloadJson: Record<string, unknown>;
    reason: string;
    idempotencyKey: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const definition = await tx.workflowDefinitionVersion.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.workflowVersionId } },
      });
      const existing = await tx.approvalRequest.findUnique({
        where: {
          tenantId_requestedByMembershipId_requestType_idempotencyKey: {
            tenantId: input.tenantId,
            requestedByMembershipId: input.requestedByMembershipId,
            requestType: input.requestType,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return existing;
      const request = await tx.approvalRequest.create({
        data: {
          tenantId: input.tenantId,
          requestType: input.requestType,
          requestedByMembershipId: input.requestedByMembershipId,
          branchId: input.branchId,
          businessDate: input.businessDate,
          scheduleVersionId: input.scheduleVersionId,
          workflowVersionId: input.workflowVersionId,
          status: 'IN_REVIEW',
          payloadJson: input.payloadJson as Prisma.InputJsonValue,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const steps = createInitialRunSteps(
        definition.stepsJson as unknown as WorkflowStepTemplate[],
      );
      await tx.approvalRunStep.createMany({
        data: steps.map((step) => ({
          tenantId: input.tenantId,
          id: step.id,
          approvalRequestId: request.id,
          stepOrder: step.stepOrder,
          mode: step.mode,
          requiredApprovalCount: step.requiredApprovalCount,
          status: step.status,
          activatedAt: step.status === 'ACTIVE' ? new Date() : null,
        })),
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'APPROVAL_REQUEST',
          aggregateId: request.id,
          eventType: 'workflow.request.submitted',
          dedupeKey: `workflow-request:${request.id}`,
          payloadRedacted: { requestId: request.id, requestType: request.requestType },
          correlationId: input.correlationId,
        },
      });
      for (const step of steps.filter((item) => item.status === 'ACTIVE')) {
        const stepTemplate = (definition.stepsJson as unknown as WorkflowStepTemplate[])[
          step.stepOrder - 1
        ];
        const approverMembershipIds = await resolveApproverMembershipIds(tx, {
          tenantId: input.tenantId,
          branchId: input.branchId,
          step: stepTemplate,
        });
        await projectApprovalActionItems(tx, {
          tenantId: input.tenantId,
          branchId: input.branchId,
          requestId: request.id,
          stepId: step.id,
          businessDate: request.businessDate ?? new Date(),
          approverMembershipIds,
          correlationId: input.correlationId,
        });
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `workflow-step-activated:${step.id}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'APPROVAL_RUN_STEP',
            aggregateId: step.id,
            eventType: 'workflow.step.activated',
            dedupeKey: `workflow-step-activated:${step.id}`,
            payloadRedacted: {
              requestId: request.id,
              requestType: request.requestType,
              stepId: step.id,
              stepOrder: step.stepOrder,
              approverMembershipIds,
            },
            correlationId: input.correlationId,
          },
        });
      }
      return request;
    });
  }

  async recordDecision(
    input: {
      tenantId: string;
      requestId: string;
      approverMembershipId: string;
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'CANCEL';
      reason: string;
      idempotencyKey: string;
      correlationId: string;
    },
    applyFinalEffect?: WorkflowFinalEffect,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM approval_requests
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.requestId}::uuid
        FOR UPDATE
      `;
      const request = await tx.approvalRequest.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.requestId } },
      });
      const activeStep = await tx.approvalRunStep.findFirst({
        where: { tenantId: input.tenantId, approvalRequestId: request.id, status: 'ACTIVE' },
        orderBy: { stepOrder: 'asc' },
      });
      if (!activeStep) return request;
      const definition = await tx.workflowDefinitionVersion.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: request.workflowVersionId } },
      });
      const stepTemplate = (definition.stepsJson as unknown as WorkflowStepTemplate[])[
        activeStep.stepOrder - 1
      ];
      await assertApproverAllowed(tx, {
        tenantId: input.tenantId,
        branchId: request.branchId,
        approverMembershipId: input.approverMembershipId,
        step: stepTemplate,
      });
      const existingDecision = await tx.approvalDecisionRecord.findFirst({
        where: {
          tenantId: input.tenantId,
          approvalRequestId: request.id,
          stepId: activeStep.id,
          approverMembershipId: input.approverMembershipId,
        },
      });
      if (existingDecision) return request;
      await tx.approvalDecisionRecord.upsert({
        where: {
          tenantId_approverMembershipId_idempotencyKey: {
            tenantId: input.tenantId,
            approverMembershipId: input.approverMembershipId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          approvalRequestId: request.id,
          stepId: activeStep.id,
          approverMembershipId: input.approverMembershipId,
          decision: input.decision,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const approvalsOnStep = await tx.approvalDecisionRecord.count({
        where: { tenantId: input.tenantId, stepId: activeStep.id, decision: 'APPROVE' },
      });
      const allSteps = await tx.approvalRunStep.findMany({
        where: { tenantId: input.tenantId, approvalRequestId: request.id },
        orderBy: { stepOrder: 'asc' },
      });
      const previouslyActiveStepIds = new Set(
        allSteps.filter((step) => step.status === 'ACTIVE').map((step) => step.id),
      );
      const resolved = applyApprovalDecision({
        requestStatus: request.status,
        steps: allSteps,
        stepId: activeStep.id,
        decision: input.decision,
        approvalsOnStep,
      });
      for (const step of resolved.steps) {
        await tx.approvalRunStep.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: step.id } },
          data: {
            status: step.status,
            completedAt: step.status === 'COMPLETED' ? new Date() : undefined,
            activatedAt: step.status === 'ACTIVE' ? new Date() : undefined,
          },
        });
      }
      if (resolved.steps.find((step) => step.id === activeStep.id)?.status === 'COMPLETED') {
        await closeApprovalActionItems(tx, {
          tenantId: input.tenantId,
          stepId: activeStep.id,
          completedAt: new Date(),
        });
      }
      const updated = await tx.approvalRequest.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: request.id } },
        data: {
          status: resolved.requestStatus,
          resolvedAt: ['APPROVED', 'REJECTED', 'CANCELLED'].includes(resolved.requestStatus)
            ? new Date()
            : null,
        },
      });
      if (updated.status === 'APPROVED' && request.status !== 'APPROVED') {
        await applyFinalEffect?.({ transaction: tx, request: updated });
      }
      await tx.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `workflow-decision:${input.tenantId}:${input.idempotencyKey}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'APPROVAL_REQUEST',
          aggregateId: request.id,
          eventType: 'workflow.decision.recorded',
          dedupeKey: `workflow-decision:${input.tenantId}:${input.idempotencyKey}`,
          payloadRedacted: {
            requestId: request.id,
            stepId: activeStep.id,
            approverMembershipId: input.approverMembershipId,
            decision: input.decision,
            status: updated.status,
          },
          correlationId: input.correlationId,
        },
      });
      for (const step of resolved.steps.filter(
        (item) => item.status === 'ACTIVE' && !previouslyActiveStepIds.has(item.id),
      )) {
        const nextStepTemplate = (definition.stepsJson as unknown as WorkflowStepTemplate[])[
          step.stepOrder - 1
        ];
        const approverMembershipIds = await resolveApproverMembershipIds(tx, {
          tenantId: input.tenantId,
          branchId: request.branchId,
          step: nextStepTemplate,
        });
        await projectApprovalActionItems(tx, {
          tenantId: input.tenantId,
          branchId: request.branchId,
          requestId: request.id,
          stepId: step.id,
          businessDate: request.businessDate ?? new Date(),
          approverMembershipIds,
          correlationId: input.correlationId,
        });
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `workflow-step-activated:${step.id}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'APPROVAL_RUN_STEP',
            aggregateId: step.id,
            eventType: 'workflow.step.activated',
            dedupeKey: `workflow-step-activated:${step.id}`,
            payloadRedacted: {
              requestId: request.id,
              requestType: request.requestType,
              stepId: step.id,
              stepOrder: step.stepOrder,
              approverMembershipIds,
            },
            correlationId: input.correlationId,
          },
        });
      }
      if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(updated.status)) {
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `workflow-request-resolved:${request.id}:${updated.status}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'APPROVAL_REQUEST',
            aggregateId: request.id,
            eventType: 'workflow.request.resolved',
            dedupeKey: `workflow-request-resolved:${request.id}:${updated.status}`,
            payloadRedacted: {
              requestId: request.id,
              requestType: request.requestType,
              requestedByMembershipId: request.requestedByMembershipId,
              status: updated.status,
            },
            correlationId: input.correlationId,
          },
        });
      }
      return updated;
    });
  }

  listSteps(tenantId: string, approvalRequestId: string) {
    return this.db.approvalRunStep.findMany({
      where: { tenantId, approvalRequestId },
      orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }],
    });
  }

  listDecisions(tenantId: string, approvalRequestId: string) {
    return this.db.approvalDecisionRecord.findMany({
      where: { tenantId, approvalRequestId },
      orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }],
    });
  }

  getClient() {
    return this.db;
  }
}

async function assertApproverAllowed(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    branchId: string;
    approverMembershipId: string;
    step?: WorkflowStepTemplate;
  },
) {
  const membership = await tx.tenantMembership.findUnique({
    where: { tenantId_id: { tenantId: input.tenantId, id: input.approverMembershipId } },
  });
  if (!membership || membership.status !== 'ACTIVE') {
    throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Nguoi duyet khong thuoc pham vi duyet.');
  }

  const rule = input.step?.approverRule ?? 'ROLE_PERMISSION';
  if (rule === 'EXPLICIT_MEMBERS') {
    if (input.step?.memberIds?.includes(input.approverMembershipId)) return;
    throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Nguoi duyet khong thuoc pham vi duyet.');
  }
  if (rule === 'TENANT_OWNER') {
    if (await hasActiveRole(tx, input.tenantId, input.approverMembershipId, 'TENANT_OWNER')) return;
    throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Nguoi duyet khong thuoc pham vi duyet.');
  }

  const permissionCode =
    rule === 'ROLE_PERMISSION'
      ? (input.step?.permissionCode ?? 'workflow.decide')
      : 'workflow.decide';
  if (
    await hasScopedPermission(
      tx,
      input.tenantId,
      input.approverMembershipId,
      permissionCode,
      input.branchId,
    )
  ) {
    return;
  }
  throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Nguoi duyet khong thuoc pham vi duyet.');
}

async function hasActiveRole(
  tx: Prisma.TransactionClient,
  tenantId: string,
  membershipId: string,
  roleCode: string,
) {
  const role = await tx.role.findUnique({ where: { tenantId_code: { tenantId, code: roleCode } } });
  if (!role) return false;
  const now = new Date();
  return Boolean(
    await tx.membershipRoleBinding.findFirst({
      where: {
        tenantId,
        membershipId,
        roleId: role.id,
        scopeType: 'TENANT',
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    }),
  );
}

async function hasScopedPermission(
  tx: Prisma.TransactionClient,
  tenantId: string,
  membershipId: string,
  permissionCode: string,
  branchId: string,
) {
  const permission = await tx.permission.findUnique({ where: { code: permissionCode } });
  if (!permission) return false;
  const rolePermissions = await tx.rolePermission.findMany({
    where: { tenantId, permissionId: permission.id },
    select: { roleId: true },
  });
  if (!rolePermissions.length) return false;
  const now = new Date();
  return Boolean(
    await tx.membershipRoleBinding.findFirst({
      where: {
        tenantId,
        membershipId,
        roleId: { in: rolePermissions.map((item) => item.roleId) },
        effectiveFrom: { lte: now },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          { OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] },
        ],
      },
    }),
  );
}

async function resolveApproverMembershipIds(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    branchId: string;
    step?: WorkflowStepTemplate;
  },
) {
  const now = new Date();
  if (input.step?.approverRule === 'EXPLICIT_MEMBERS') {
    const memberships = await tx.tenantMembership.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: input.step.memberIds ?? [] },
        status: 'ACTIVE',
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return memberships.map((membership) => membership.id);
  }
  let roleIds: string[] = [];
  if (input.step?.approverRule === 'TENANT_OWNER') {
    const ownerRole = await tx.role.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code: 'TENANT_OWNER' } },
      select: { id: true },
    });
    roleIds = ownerRole ? [ownerRole.id] : [];
  } else {
    const permission = await tx.permission.findUnique({
      where: { code: input.step?.permissionCode ?? 'workflow.decide' },
      select: { id: true },
    });
    if (permission) {
      roleIds = (
        await tx.rolePermission.findMany({
          where: { tenantId: input.tenantId, permissionId: permission.id },
          select: { roleId: true },
        })
      ).map((binding) => binding.roleId);
    }
  }
  if (!roleIds.length) return [];
  const bindings = await tx.membershipRoleBinding.findMany({
    where: {
      tenantId: input.tenantId,
      roleId: { in: roleIds },
      effectiveFrom: { lte: now },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
        { OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId: input.branchId }] },
      ],
    },
    select: { membershipId: true },
    orderBy: { membershipId: 'asc' },
  });
  const activeMemberships = await tx.tenantMembership.findMany({
    where: {
      tenantId: input.tenantId,
      id: { in: bindings.map((binding) => binding.membershipId) },
      status: 'ACTIVE',
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return activeMemberships.map((membership) => membership.id);
}

async function projectApprovalActionItems(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    branchId: string;
    requestId: string;
    stepId: string;
    businessDate: Date;
    approverMembershipIds: string[];
    correlationId: string;
  },
) {
  const now = new Date();
  for (const ownerMembershipId of input.approverMembershipIds) {
    const item = await tx.actionItem.upsert({
      where: {
        tenantId_ownerMembershipId_itemType_sourceType_sourceId_businessDate: {
          tenantId: input.tenantId,
          ownerMembershipId,
          itemType: 'DATA_QUALITY',
          sourceType: 'APPROVAL_DECISION_REQUIRED',
          sourceId: input.stepId,
          businessDate: input.businessDate,
        },
      },
      update: {
        state: 'OPEN',
        completedAt: null,
        sourceFreshnessAt: now,
        stateVersion: { increment: 1 },
      },
      create: {
        tenantId: input.tenantId,
        ownerMembershipId,
        branchId: input.branchId,
        itemType: 'DATA_QUALITY',
        sourceType: 'APPROVAL_DECISION_REQUIRED',
        sourceId: input.stepId,
        businessDate: input.businessDate,
        state: 'OPEN',
        title: 'Co yeu cau can duyet',
        deadlineAt: now,
        sourceFreshnessAt: now,
        deepLink: `adsup://attendance/workflows/${input.requestId}`,
      },
    });
    await tx.outboxEvent.upsert({
      where: {
        tenantId_dedupeKey: {
          tenantId: input.tenantId,
          dedupeKey: `workflow-action-item:${item.id}:v${item.stateVersion}`,
        },
      },
      update: {},
      create: {
        tenantId: input.tenantId,
        aggregateType: 'ACTION_ITEM',
        aggregateId: item.id,
        eventType: 'action-item.changed',
        dedupeKey: `workflow-action-item:${item.id}:v${item.stateVersion}`,
        payloadRedacted: {
          actionItemId: item.id,
          ownerMembershipId,
          state: item.state,
          stateVersion: item.stateVersion,
        },
        correlationId: input.correlationId,
      },
    });
  }
}

async function closeApprovalActionItems(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; stepId: string; completedAt: Date },
) {
  await tx.actionItem.updateMany({
    where: {
      tenantId: input.tenantId,
      sourceType: 'APPROVAL_DECISION_REQUIRED',
      sourceId: input.stepId,
      state: { in: ['OPEN', 'OVERDUE'] },
    },
    data: {
      state: 'COMPLETED',
      completedAt: input.completedAt,
      sourceFreshnessAt: input.completedAt,
      stateVersion: { increment: 1 },
    },
  });
}
