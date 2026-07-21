import { Router } from 'express';
import { z } from 'zod';
import { businessDateSchema, evaluationRerunSchema, uuidSchema } from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { KpiEvaluationService } from './kpi-evaluation-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from './kpi-http.js';

export function kpiEvaluationRoutes(
  tokens: TokenService,
  service: KpiEvaluationService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.get(
    '/tenants/:tenantId/kpi/evaluations',
    auth,
    scoped,
    requirePermission(
      rbacRepo,
      'kpi.evaluation.view',
      (request) => request.query.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const query = z
        .object({
          branchId: uuidSchema.optional(),
          membershipId: uuidSchema.optional(),
          from: businessDateSchema.optional(),
          to: businessDateSchema.optional(),
          status: z.enum(['PASSED', 'FAILED', 'EXEMPT']).optional(),
          cursor: z.string().max(1024).optional(),
        })
        .parse(request.query);
      const items = await service.list({
        tenantId: request.tenant!.tenantId,
        branchId: query.branchId,
        membershipId: query.membershipId,
        from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
        to: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined,
        status: query.status,
        cursor: query.cursor,
      });
      response.json(kpiJsonSafe(items));
    },
  );
  router.post(
    '/tenants/:tenantId/kpi/evaluations/:businessDate/reruns',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.evaluation.rerun'),
    async (request: AuthenticatedRequest, response) => {
      const businessDate = businessDateSchema.parse(request.params.businessDate);
      const body = evaluationRerunSchema.strict().parse(request.body);
      const run = await tenantIdempotent(
        governance,
        request,
        'kpi-evaluation.rerun',
        { businessDate, ...body },
        () =>
          service.enqueueRerun({
            ...body,
            businessDate: new Date(`${businessDate}T00:00:00.000Z`),
            tenantId: request.tenant!.tenantId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(202).json(kpiJsonSafe({ jobRunId: run.id, status: run.status }));
    },
  );
  return router;
}
