import { Router } from 'express';
import {
  createKpiDefinitionSchema,
  createSourceMappingSchema,
  createTargetVersionSchema,
} from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { KpiConfigService } from './kpi-config-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from './kpi-http.js';

export function kpiConfigRoutes(
  tokens: TokenService,
  service: KpiConfigService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.get(
    '/tenants/:tenantId/kpi/definitions',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.view'),
    async (request: AuthenticatedRequest, response) =>
      response.json({
        items: kpiJsonSafe(await service.list(request.tenant!.tenantId)),
        nextCursor: null,
      }),
  );
  router.post(
    '/tenants/:tenantId/kpi/definitions',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.configure'),
    async (request: AuthenticatedRequest, response) => {
      const body = createKpiDefinitionSchema.strict().parse(request.body);
      const result = await tenantIdempotent(
        governance,
        request,
        'kpi-definition.create',
        body,
        () =>
          service.createDefinition({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );
  router.post(
    '/tenants/:tenantId/kpi/targets',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.target.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = createTargetVersionSchema.parse(request.body);
      const result = await tenantIdempotent(governance, request, 'kpi-target.create', body, () =>
        service.createTarget({
          ...body,
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
          correlationId: request.tenant!.correlationId,
        }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );
  router.post(
    '/tenants/:tenantId/kpi/source-mappings',
    auth,
    scoped,
    requirePermission(rbacRepo, 'kpi.configure'),
    async (request: AuthenticatedRequest, response) => {
      const body = createSourceMappingSchema.parse(request.body);
      const result = await tenantIdempotent(
        governance,
        request,
        'kpi-source-mapping.create',
        body,
        () =>
          service.createSourceMapping({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );
  return router;
}
