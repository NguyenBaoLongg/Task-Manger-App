import { Router } from 'express';
import {
  createAttendancePenaltyPolicyRequestSchema,
  paymentTransitionRequestSchema,
  penaltySettlementQuerySchema,
} from '@adsup/contracts';
import { ProblemError } from '@adsup/domain';
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
    getSettlement(
      tenantId: string,
      settlementId: string,
    ): Promise<{ membershipId: string; branchId: string } | null>;
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
    async (request: AuthenticatedRequest, response) => {
      const query = penaltySettlementQuerySchema.parse(request.query);
      const [canManage, canReadSelf] = await Promise.all([
        deps.rbacRepo!.hasPermission(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          'attendance.penalty.payment.manage',
          query.branchId,
        ),
        deps.rbacRepo!.hasPermission(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          'attendance.penalty.self',
        ),
      ]);
      if (!canManage && !canReadSelf) {
        throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Khong co quyen xem khoan phat.');
      }
      response.json(
        kpiJsonSafe(
          await deps.penaltyService!.listSettlements({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            canManage,
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
    async (request: AuthenticatedRequest, response) => {
      const body = paymentTransitionRequestSchema.parse(request.body);
      const settlement = await deps.penaltyService!.getSettlement(
        request.tenant!.tenantId,
        String(request.params.settlementId),
      );
      if (!settlement)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Khong tim thay khoan phat.');
      const [selfAllowed, canManage] = await Promise.all([
        deps.rbacRepo!.hasPermission(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          'attendance.penalty.self',
        ),
        deps.rbacRepo!.hasPermission(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          'attendance.penalty.payment.manage',
          settlement.branchId,
        ),
      ]);
      const isOwnSubmission =
        body.toStatus === 'SUBMITTED' &&
        selfAllowed &&
        settlement.membershipId === request.tenant!.membershipId;
      if (!isOwnSubmission && !canManage) {
        throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Khong co quyen xu ly khoan phat.');
      }
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.penalty-payment.transition',
        body,
        () =>
          deps.penaltyService!.transitionPayment({
            ...body,
            tenantId: request.tenant!.tenantId,
            settlementId: String(request.params.settlementId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
            idempotencyKey: request.header('idempotency-key') ?? request.tenant!.correlationId,
            canManage,
          }),
      );
      response.json(kpiJsonSafe(result));
    },
  );

  return router;
}
