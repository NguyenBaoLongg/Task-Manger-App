import { Router } from 'express';
import { z } from 'zod';
import { bulkPolicySchema, businessDateSchema, uuidSchema } from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { KpiPolicyService } from './kpi-policy-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from './kpi-http.js';

export function kpiPolicyRoutes(
  tokens: TokenService,
  service: KpiPolicyService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.post(
    '/tenants/:tenantId/kpi/policies:bulk',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.policy.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = bulkPolicySchema.parse(request.body);
      const versions = await tenantIdempotent(
        governance,
        request,
        'kpi-policy.bulk-create',
        body,
        () =>
          service.bulkCreate({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe({ affectedBranchIds: body.branchIds, versions }));
    },
  );
  router.get(
    '/tenants/:tenantId/kpi/policies/effective',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.view', (request) =>
      typeof request.query.branchId === 'string' ? request.query.branchId : '',
    ),
    async (request: AuthenticatedRequest, response) => {
      const query = z
        .object({ branchId: uuidSchema, businessDate: businessDateSchema })
        .parse(request.query);
      response.json(
        kpiJsonSafe(
          await service.effective(request.tenant!.tenantId, query.branchId, query.businessDate),
        ),
      );
    },
  );
  return router;
}
