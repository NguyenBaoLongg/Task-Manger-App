import { Router } from 'express';
import { createExportSchema } from '@adsup/contracts';
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
import { readIdempotencyKey, tenantIdempotent } from '../../http/idempotency.js';
import type { ExportService } from './export-service.js';

export interface ExportRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly exportService?: ExportService;
}

export function exportRoutes(deps: ExportRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);
  const service = deps.exportService;
  router.get(
    '/tenants/:tenantId/exports',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.export.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!service) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const limit =
        typeof request.query.limit === 'string' ? Number(request.query.limit) : undefined;
      return response.json(
        await service.list({
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
          cursor: typeof request.query.cursor === 'string' ? request.query.cursor : undefined,
          limit,
        }),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/exports',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.export.create'),
    async (request: AuthenticatedRequest, response) => {
      if (!service) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = createExportSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.export.create',
        body,
        () =>
          service.create({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            idempotencyKey: readIdempotencyKey(request),
            correlationId: request.tenant!.correlationId,
            input: body,
          }),
      );
      return response.status(202).json(result.export);
    },
  );
  router.get(
    '/tenants/:tenantId/exports/:exportId',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.export.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!service) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      return response.json(
        await service.get({
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
          exportId: String(request.params.exportId),
        }),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/exports/:exportId/download-url',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.export.download'),
    async (request: AuthenticatedRequest, response) => {
      if (!service) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.export.download',
        { exportId: String(request.params.exportId) },
        () =>
          service.createDownloadUrl({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            exportId: String(request.params.exportId),
          }),
      );
      return response.json(result);
    },
  );
  return router;
}
