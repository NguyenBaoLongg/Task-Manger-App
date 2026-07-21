import { parseWorkflowPayload } from '@adsup/contracts';
import { ProblemError, systemClock, type Clock } from '@adsup/domain';
import type { WorkflowRepository } from '@adsup/database';
import { readIdempotencyKey } from '../../http/idempotency.js';
import type { AuthenticatedRequest } from '../../http/middleware/auth.js';
import type { LeaveService } from '../attendance/leave-service.js';
import { WorkflowEffects } from './workflow-effects.js';

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class WorkflowService {
  constructor(
    private readonly repository: WorkflowRepository,
    private readonly effects = new WorkflowEffects(),
    private readonly clock: Clock = systemClock,
    private readonly leaveService?: LeaveService,
  ) {}

  createDefinitionVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    requestType: 'SHIFT_CHANGE' | 'LATE_NOTICE' | 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string;
    effectiveFromDate?: string;
    effectiveToDate?: string | null;
    steps: Array<{ mode: 'SEQUENTIAL' | 'PARALLEL'; requiredApprovalCount: number }>;
    reason: string;
  }) {
    return this.repository.createDefinitionVersion({
      ...input,
      branchId: input.branchId ?? null,
      effectiveFromDate: input.effectiveFromDate
        ? dateOnly(input.effectiveFromDate)
        : new Date(this.clock.now().toISOString().slice(0, 10)),
      effectiveToDate: input.effectiveToDate ? dateOnly(input.effectiveToDate) : null,
    });
  }

  async submitRequest(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    requestType: 'SHIFT_CHANGE' | 'LATE_NOTICE' | 'LEAVE_SCHEDULE' | 'SUDDEN_LEAVE';
    payload: Record<string, unknown>;
    reason: string;
    idempotencyKey?: string;
  }) {
    const parsedPayload = parseWorkflowPayload(input.requestType, input.payload) as Record<
      string,
      unknown
    >;
    const businessDate =
      typeof parsedPayload.businessDate === 'string'
        ? dateOnly(parsedPayload.businessDate)
        : typeof parsedPayload.startDate === 'string'
          ? dateOnly(parsedPayload.startDate)
          : null;
    const assignment = await this.repository.getClient().assignment.findFirst({
      where: {
        tenantId: input.tenantId,
        membershipId: input.actorMembershipId,
        status: 'ACTIVE',
        effectiveFrom: { lte: this.clock.now() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: this.clock.now() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!assignment) {
      throw new ProblemError(422, 'NO_ACTIVE_BRANCH', 'Khong co co so hieu luc.');
    }
    const definitions = await this.repository.listEffectiveDefinitions({
      tenantId: input.tenantId,
      requestType: input.requestType,
      branchId: assignment.branchId,
      businessDate: businessDate ?? new Date(this.clock.now().toISOString().slice(0, 10)),
    });
    const definition = definitions[0];
    if (!definition) {
      throw new ProblemError(422, 'BUSINESS_RULE_VIOLATION', 'Chua co workflow phu hop.');
    }
    await this.leaveService?.validateBeforeSubmit({
      tenantId: input.tenantId,
      requestType: input.requestType,
      requestedByMembershipId: input.actorMembershipId,
      branchId: assignment.branchId,
      payload: parsedPayload,
    });
    const request = await this.repository.submitRequest({
      tenantId: input.tenantId,
      requestType: input.requestType,
      requestedByMembershipId: input.actorMembershipId,
      branchId: assignment.branchId,
      businessDate,
      workflowVersionId: definition.id,
      payloadJson: parsedPayload,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey ?? input.correlationId,
      correlationId: input.correlationId,
    });
    await this.leaveService?.captureSubmissionSnapshot({
      tenantId: input.tenantId,
      approvalRequestId: request.id,
      requestType: input.requestType,
      requestedByMembershipId: input.actorMembershipId,
      branchId: assignment.branchId,
      payload: parsedPayload,
    });
    return request;
  }

  async decide(input: {
    tenantId: string;
    requestId: string;
    actorMembershipId: string;
    correlationId: string;
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'CANCEL';
    reason: string;
    idempotencyKey?: string;
  }) {
    const updated = await this.repository.recordDecision({
      tenantId: input.tenantId,
      requestId: input.requestId,
      approverMembershipId: input.actorMembershipId,
      decision: input.decision,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey ?? input.correlationId,
      correlationId: input.correlationId,
    });
    await this.effects.applyFinalEffects({
      request: updated,
      actorMembershipId: input.actorMembershipId,
      correlationId: input.correlationId,
    });
    return updated;
  }
}

export function idempotencyKeyFromRequest(request: AuthenticatedRequest) {
  return readIdempotencyKey(request);
}
