import { Router } from 'express';
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
} from '../../http/middleware/auth.js';

export interface ExportRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly exportService?: unknown;
}

export function exportRoutes(deps: ExportRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);
  router.post(
    '/tenants/:tenantId/exports',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.export.create'),
    (_request, response) => response.status(501).json({ code: 'MODULE_NOT_READY' }),
  );
  router.post(
    '/tenants/:tenantId/exports/:exportId/download-url',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.export.download'),
    (_request, response) => response.status(501).json({ code: 'MODULE_NOT_READY' }),
  );
  return router;
}
