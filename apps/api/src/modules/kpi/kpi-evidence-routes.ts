import { Router } from 'express';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { KpiEvidenceService } from './kpi-evidence-service.js';
import {
  authenticate,
  requireAnyScopedPermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from './kpi-http.js';

export function kpiEvidenceRoutes(
  tokens: TokenService,
  service: KpiEvidenceService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  router.post(
    '/tenants/:tenantId/kpi/evidence-debts/:debtId/refresh',
    authenticate(tokens),
    tenantContext(authRepo),
    requireAnyScopedPermission(rbacRepo, 'kpi.report.submit'),
    async (request: AuthenticatedRequest, response) => {
      const result = await tenantIdempotent(
        governance,
        request,
        'kpi-evidence.refresh',
        { debtId: request.params.debtId },
        () =>
          service.refresh({
            tenantId: request.tenant!.tenantId,
            membershipId: request.tenant!.membershipId,
            debtId: String(request.params.debtId),
            now: new Date(),
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.json(
        kpiJsonSafe({
          ...result,
          remainingCount: Math.max(0, result.requiredCount - result.receivedCount),
        }),
      );
    },
  );
  return router;
}
