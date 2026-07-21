import { Router } from 'express';
import {
  createAttendancePenaltyPolicyRequestSchema,
  paymentTransitionRequestSchema,
  penaltySettlementQuerySchema,
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

export interface PenaltyRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly penaltyService?: {
    createPolicyVersion(input: Record<string, unknown>): Promise<unknown>;
    listSettlements(input: Record<string, unknown>): Promise<unknown>;
    transitionPayment(input: Record<string, unknown>): Promise<unknown>;
  };
}

export function penaltyRoutes(deps: PenaltyRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);

  router.post(
    '/tenants/:tenantId/attendance/penalty-policies',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.penalty-policy.manage', (request) => {
      const body = request.body as { branchId?: unknown };
      return typeof body.branchId === 'string' ? body.branchId : undefined;
    }),
    async (request: AuthenticatedRequest, response) => {
      const body = createAttendancePenaltyPolicyRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.penalty-policy.create',
        body,
        () =>
          deps.penaltyService!.createPolicyVersion({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.get(
    '/tenants/:tenantId/attendance/penalty-settlements',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.penalty.payment.manage', (request) =>
      typeof request.query.branchId === 'string' ? request.query.branchId : undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const query = penaltySettlementQuerySchema.parse(request.query);
      response.json(
        kpiJsonSafe(
          await deps.penaltyService!.listSettlements({
            tenantId: request.tenant!.tenantId,
            ...query,
          }),
        ),
      );
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/penalty-settlements/:settlementId/payment-transitions',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.penalty.payment.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = paymentTransitionRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.penalty-payment.transition',
        body,
        () =>
          deps.penaltyService!.transitionPayment({
            ...body,
            tenantId: request.tenant!.tenantId,
            settlementId: request.params.settlementId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
            idempotencyKey: request.header('idempotency-key') ?? request.tenant!.correlationId,
          }),
      );
      response.json(kpiJsonSafe(result));
    },
  );

  return router;
}
