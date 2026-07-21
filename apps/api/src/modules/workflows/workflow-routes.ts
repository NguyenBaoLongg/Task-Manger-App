import { Router } from 'express';
import {
  approvalDecisionRequestSchema,
  createWorkflowDefinitionRequestSchema,
  submitApprovalRequestSchema,
} from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from '../kpi/kpi-http.js';

export interface WorkflowRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly workflowService?: {
    createDefinitionVersion(input: Record<string, unknown>): Promise<unknown>;
    submitRequest(input: Record<string, unknown>): Promise<unknown>;
    decide(input: Record<string, unknown>): Promise<unknown>;
  };
}

export function workflowRoutes(deps: WorkflowRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);

  router.post(
    '/tenants/:tenantId/workflows/definitions',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'workflow.configure', (request) => {
      const body = request.body as { branchId?: unknown };
      return typeof body.branchId === 'string' ? body.branchId : undefined;
    }),
    async (request: AuthenticatedRequest, response) => {
      const body = createWorkflowDefinitionRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'workflow.definition.create',
        body,
        () =>
          deps.workflowService!.createDefinitionVersion({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/workflows/requests',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.schedule.self'),
    async (request: AuthenticatedRequest, response) => {
      const body = submitApprovalRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'workflow.request.submit',
        body,
        () =>
          deps.workflowService!.submitRequest({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/workflows/requests/:requestId/decisions',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'workflow.decide'),
    async (request: AuthenticatedRequest, response) => {
      const body = approvalDecisionRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'workflow.decision.create',
        body,
        () =>
          deps.workflowService!.decide({
            ...body,
            tenantId: request.tenant!.tenantId,
            requestId: request.params.requestId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.json(kpiJsonSafe(result));
    },
  );

  return router;
}
