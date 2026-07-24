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

export interface BookingRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly customerService?: unknown;
  readonly bookingService?: unknown;
  readonly arrivalService?: unknown;
}

export function bookingRoutes(deps: BookingRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);
  const unavailable = (_request: unknown, response: { status(code: number): { json(body: unknown): void } }) =>
    response.status(501).json({ code: 'MODULE_NOT_READY' });

  router.get(
    '/tenants/:tenantId/customers',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.customer.read'),
    unavailable,
  );
  router.post(
    '/tenants/:tenantId/bookings',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.manage'),
    unavailable,
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/customer-photo-consents',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.arrival.manage'),
    unavailable,
  );
  return router;
}
