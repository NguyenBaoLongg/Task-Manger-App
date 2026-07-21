import { Router } from 'express';
import { z } from 'zod';
import { businessDateSchema, createReportRevisionSchema } from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { KpiProgressService } from './kpi-progress-service.js';
import type { KpiReportService } from './kpi-report-service.js';
import {
  authenticate,
  requireAnyScopedPermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from './kpi-http.js';

export function kpiReportRoutes(
  tokens: TokenService,
  reports: KpiReportService,
  progress: KpiProgressService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.get(
    '/tenants/:tenantId/kpi/reports/:businessDate/revisions',
    auth,
    scoped,
    requireAnyScopedPermission(rbacRepo, 'kpi.view'),
    async (request: AuthenticatedRequest, response) => {
      const businessDate = businessDateSchema.parse(request.params.businessDate);
      const query = z.object({ cursor: z.string().max(1024).optional() }).parse(request.query);
      const page = await reports.revisions(
        request.tenant!.tenantId,
        request.tenant!.membershipId,
        businessDate,
        query.cursor,
      );
      response.json(kpiJsonSafe(page));
    },
  );
  router.post(
    '/tenants/:tenantId/kpi/reports/:businessDate/revisions',
    auth,
    scoped,
    requireAnyScopedPermission(rbacRepo, 'kpi.report.submit'),
    async (request: AuthenticatedRequest, response) => {
      const businessDate = businessDateSchema.parse(request.params.businessDate);
      const body = createReportRevisionSchema.strict().parse(request.body);
      const result = await tenantIdempotent(
        governance,
        request,
        'kpi-report-revision.create',
        { businessDate, ...body },
        async () => {
          const revision = await reports.appendRevision({
            ...body,
            businessDate,
            tenantId: request.tenant!.tenantId,
            membershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          });
          await progress.current({
            businessDate,
            tenantId: request.tenant!.tenantId,
            membershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          });
          return revision;
        },
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );
  router.get(
    '/tenants/:tenantId/kpi/reports/:businessDate/progress',
    auth,
    scoped,
    requireAnyScopedPermission(rbacRepo, 'kpi.view'),
    async (request: AuthenticatedRequest, response) => {
      const businessDate = businessDateSchema.parse(request.params.businessDate);
      response.json(
        kpiJsonSafe(
          await progress.current({
            businessDate,
            tenantId: request.tenant!.tenantId,
            membershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
        ),
      );
    },
  );
  return router;
}
