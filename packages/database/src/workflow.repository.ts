import type { DatabaseClient } from './client.js';
import {
  applyApprovalDecision,
  createInitialRunSteps,
  type WorkflowStepTemplate,
} from '@adsup/domain';
import type { Prisma } from './generated/prisma/client.js';

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
      orderBy: [{ scopeType: 'asc' }, { versionNumber: 'desc' }, { id: 'desc' }],
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
      return request;
    });
  }

  async recordDecision(input: {
    tenantId: string;
    requestId: string;
    approverMembershipId: string;
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'CANCEL';
    reason: string;
    idempotencyKey: string;
    correlationId: string;
  }) {
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
      const updated = await tx.approvalRequest.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: request.id } },
        data: {
          status: resolved.requestStatus,
          resolvedAt: ['APPROVED', 'REJECTED', 'CANCELLED'].includes(resolved.requestStatus)
            ? new Date()
            : null,
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'APPROVAL_REQUEST',
          aggregateId: request.id,
          eventType: 'workflow.request.decided',
          dedupeKey: `workflow-decision:${input.tenantId}:${input.idempotencyKey}`,
          payloadRedacted: { requestId: request.id, status: updated.status },
          correlationId: input.correlationId,
        },
      });
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
