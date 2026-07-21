import { Router } from 'express';
import { z } from 'zod';
import type { TokenService } from '../auth/token-service.js';
import type { RbacService } from './rbac-service.js';
import type { OrganizationService } from '../organization/organization-service.js';
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

export function rbacRoutes(
  tokens: TokenService,
  service: RbacService,
  organization: OrganizationService,
  authRepo: AuthTenantsRepository,
  repository: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  const memberRead = requirePermission(repository, 'member.read');
  const memberManage = requirePermission(
    repository,
    'member.manage',
    (request) => request.body?.branchId as string | undefined,
  );
  const roleRead = requirePermission(repository, 'role.read');
  const roleManage = requirePermission(repository, 'role.manage');
  router.get(
    '/tenants/:tenantId/memberships',
    auth,
    scoped,
    memberRead,
    async (request: AuthenticatedRequest, response) => {
      const cursor = z.string().max(512).optional().parse(request.query.cursor);
      const page = await service.listMemberships(request.tenant!.tenantId, cursor);
      response.json({
        ...page,
        items: page.items.map((item) => ({
          ...item,
          displayName: item.membershipDisplayName,
        })),
      });
    },
  );
  router.patch(
    '/tenants/:tenantId/memberships/:membershipId',
    auth,
    scoped,
    memberManage,
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          displayName: z.string().min(2).max(120).optional(),
          employeeCode: z.string().max(40).nullable().optional(),
          status: z.enum(['ACTIVE', 'SUSPENDED', 'LEFT']).optional(),
          reason: z.string().min(3).max(500),
        })
        .strict()
        .parse(request.body);
      const membership = await tenantIdempotent(
        governance,
        request,
        'membership.update',
        body,
        () =>
          service.updateMembership({
            tenantId: request.tenant!.tenantId,
            membershipId: String(request.params.membershipId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
      );
      response.json({ ...membership, displayName: membership.membershipDisplayName });
    },
  );
  router.post(
    '/tenants/:tenantId/memberships/:membershipId/assignments',
    auth,
    scoped,
    memberManage,
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          branchId: z.string().uuid(),
          departmentId: z.string().uuid().optional(),
          positionId: z.string().uuid().optional(),
          effectiveFrom: z.coerce.date(),
          effectiveTo: z.coerce.date().optional(),
          reason: z.string().min(3).max(500),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'assignment.create', body, () =>
          organization.createAssignment({
            tenantId: request.tenant!.tenantId,
            membershipId: String(request.params.membershipId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
        ),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/memberships/:membershipId/assignments',
    auth,
    scoped,
    memberRead,
    async (request: AuthenticatedRequest, response) => {
      const query = z
        .object({
          at: z.coerce.date().optional(),
          includeHistory: z
            .enum(['true', 'false'])
            .transform((value) => value === 'true')
            .optional(),
        })
        .parse(request.query);
      response.json(
        await organization.listAssignments({
          tenantId: request.tenant!.tenantId,
          membershipId: String(request.params.membershipId),
          ...query,
        }),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/roles',
    auth,
    scoped,
    roleRead,
    async (request: AuthenticatedRequest, response) =>
      response.json(await service.listRoles(request.tenant!.tenantId)),
  );
  router.post(
    '/tenants/:tenantId/roles',
    auth,
    scoped,
    roleManage,
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          name: z.string().min(2).max(120),
          code: z.string().regex(/^[A-Z0-9_-]{2,40}$/),
          permissionCodes: z
            .array(z.string().min(2).max(80))
            .max(100)
            .refine((items) => new Set(items).size === items.length, {
              message: 'permissionCodes must be unique',
            }),
          reason: z.string().min(3).max(500),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'role.create', body, () =>
          service.createRole({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
        ),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/memberships/:membershipId/role-bindings',
    auth,
    scoped,
    roleManage,
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          roleId: z.string().uuid(),
          scopeType: z.enum(['TENANT', 'BRANCH']),
          branchId: z.string().uuid().optional(),
          effectiveFrom: z.coerce.date(),
          effectiveTo: z.coerce.date().optional(),
          reason: z.string().min(3).max(500),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'role-binding.create', body, () =>
          service.grantBinding({
            tenantId: request.tenant!.tenantId,
            membershipId: String(request.params.membershipId),
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
