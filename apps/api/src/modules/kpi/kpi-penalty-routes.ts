import { Router } from 'express';
import { penaltyAdjustmentSchema } from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { KpiPenaltyService } from './kpi-penalty-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { readIdempotencyKey, tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from './kpi-http.js';

export function kpiPenaltyRoutes(
  tokens: TokenService,
  service: KpiPenaltyService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  router.post(
    '/tenants/:tenantId/kpi/penalties/:penaltyId/adjustments',
    authenticate(tokens),
    tenantContext(authRepo),
    requirePermission(rbacRepo, 'kpi.penalty.adjust'),
    async (request: AuthenticatedRequest, response) => {
      const body = penaltyAdjustmentSchema.strict().parse(request.body);
      const result = await tenantIdempotent(
        governance,
        request,
        'kpi-penalty.adjust',
        { penaltyId: request.params.penaltyId, ...body },
        () =>
          service.adjust({
            ...body,
            tenantId: request.tenant!.tenantId,
            penaltyId: String(request.params.penaltyId),
            actorMembershipId: request.tenant!.membershipId,
            idempotencyKey: readIdempotencyKey(request),
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(
        kpiJsonSafe({
          ...result.adjustment,
          penaltyId: result.adjustment.penaltyOutcomeId,
          effectiveAmountMinor: result.effectiveAmountMinor,
        }),
      );
    },
  );
  return router;
}
