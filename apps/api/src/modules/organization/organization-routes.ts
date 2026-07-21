import { Router } from 'express';
import { z } from 'zod';
import type { TokenService } from '../auth/token-service.js';
import type { OrganizationService } from './organization-service.js';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';

const orgBody = z
  .object({
    code: z.string().regex(/^[A-Z0-9_-]{2,32}$/),
    name: z.string().min(2).max(160),
  })
  .strict();
const lifecycleBody = z
  .object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
    reason: z.string().min(3).max(500),
  })
  .strict();

export function organizationRoutes(
  tokens: TokenService,
  service: OrganizationService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  const tenantRead = requirePermission(rbacRepo, 'tenant.read');
  const branchManage = requirePermission(rbacRepo, 'branch.manage');
  const orgManage = requirePermission(rbacRepo, 'organization.manage');
  router.get(
    '/tenants/:tenantId/branches',
    auth,
    scoped,
    tenantRead,
    async (request: AuthenticatedRequest, response) =>
      response.json(await service.listBranches(request.tenant!.tenantId)),
  );
  router.post(
    '/tenants/:tenantId/branches',
    auth,
    scoped,
    branchManage,
    async (request: AuthenticatedRequest, response) => {
      const body = orgBody
        .extend({ timezoneOverride: z.string().min(3).max(64).optional() })
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'branch.create', body, () =>
          service.createBranch({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            ...body,
          }),
        ),
      );
    },
  );
  router.patch(
    '/tenants/:tenantId/branches/:branchId',
    auth,
    scoped,
    requirePermission(rbacRepo, 'branch.manage', (request) => String(request.params.branchId)),
    async (request: AuthenticatedRequest, response) => {
      const body = lifecycleBody.parse(request.body);
      response.json(
        await tenantIdempotent(governance, request, 'branch.status.update', body, () =>
          service.updateBranchStatus({
            tenantId: request.tenant!.tenantId,
            id: String(request.params.branchId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
        ),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/departments',
    auth,
    scoped,
    tenantRead,
    async (request: AuthenticatedRequest, response) =>
      response.json(await service.listDepartments(request.tenant!.tenantId)),
  );
  router.post(
    '/tenants/:tenantId/departments',
    auth,
    scoped,
    orgManage,
    async (request: AuthenticatedRequest, response) => {
      const body = orgBody.parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'department.create', body, () =>
          service.createDepartment({
            tenantId: request.tenant!.tenantId,
            ...body,
          }),
        ),
      );
    },
  );
  router.patch(
    '/tenants/:tenantId/departments/:departmentId',
    auth,
    scoped,
    orgManage,
    async (request: AuthenticatedRequest, response) => {
      const body = lifecycleBody.parse(request.body);
      response.json(
        await tenantIdempotent(governance, request, 'department.status.update', body, () =>
          service.updateDepartmentStatus({
            tenantId: request.tenant!.tenantId,
            id: String(request.params.departmentId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
        ),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/positions',
    auth,
    scoped,
    tenantRead,
    async (request: AuthenticatedRequest, response) =>
      response.json(await service.listPositions(request.tenant!.tenantId)),
  );
  router.post(
    '/tenants/:tenantId/positions',
    auth,
    scoped,
    orgManage,
    async (request: AuthenticatedRequest, response) => {
      const body = orgBody.parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'position.create', body, () =>
          service.createPosition({
            tenantId: request.tenant!.tenantId,
            ...body,
          }),
        ),
      );
    },
  );
  router.patch(
    '/tenants/:tenantId/positions/:positionId',
    auth,
    scoped,
    orgManage,
    async (request: AuthenticatedRequest, response) => {
      const body = lifecycleBody.parse(request.body);
      response.json(
        await tenantIdempotent(governance, request, 'position.status.update', body, () =>
          service.updatePositionStatus({
            tenantId: request.tenant!.tenantId,
            id: String(request.params.positionId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
        ),
      );
    },
  );
  return router;
}
