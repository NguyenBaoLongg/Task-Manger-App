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

export interface BookingConfigRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly configService?: unknown;
  readonly reportService?: unknown;
}

export function bookingConfigRoutes(deps: BookingConfigRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  router.post(
    '/tenants/:tenantId/booking-reports:rerun',
    authenticate(deps.tokens),
    tenantContext(deps.authRepo),
    requirePermission(deps.rbacRepo, 'booking.report.rerun'),
    (_request, response) => response.status(501).json({ code: 'MODULE_NOT_READY' }),
  );
  return router;
}
