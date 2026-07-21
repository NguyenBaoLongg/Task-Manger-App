import { Router } from 'express';
import { z } from 'zod';
import type { TokenService } from '../auth/token-service.js';
import type { TenantService } from './tenant-service.js';
import type { InvitationService } from './invitation-service.js';
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
import { accountIdempotent, tenantIdempotent } from '../../http/idempotency.js';

export function tenantRoutes(
  tokens: TokenService,
  tenants: TenantService,
  invitations: InvitationService,
  repository: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(repository);
  const lifecycleScoped = tenantContext(repository, { allowInactiveTenant: true });
  router.get('/me/tenants', auth, async (request: AuthenticatedRequest, response) =>
    response.json(await tenants.list(request.auth!.userId)),
  );
  router.post('/tenants', auth, async (request: AuthenticatedRequest, response) => {
    const body = z
      .object({ name: z.string().min(2).max(160), timezone: z.string().min(3).max(64) })
      .strict()
      .parse(request.body);
    const idempotencyKey = z.string().min(8).max(128).parse(request.header('idempotency-key'));
    response.status(201).json(
      await tenants.create({
        userId: request.auth!.userId,
        name: body.name,
        timezone: body.timezone,
        correlationId: request.header('x-correlation-id')!,
        idempotencyKey,
      }),
    );
  });
  router.post('/invitations/accept', auth, async (request: AuthenticatedRequest, response) => {
    const body = z
      .object({ token: z.string().min(20).max(512) })
      .strict()
      .parse(request.body);
    const idempotencyKey = z.string().min(8).max(128).parse(request.header('idempotency-key'));
    const membership = await accountIdempotent(governance, request, 'invitation.accept', body, () =>
      invitations.accept(
        request.auth!.userId,
        body.token,
        request.header('x-correlation-id')!,
        idempotencyKey,
      ),
    );
    response.status(201).json({
      ...membership,
      displayName: membership.membershipDisplayName,
    });
  });
  router.get(
    '/tenants/:tenantId',
    auth,
    scoped,
    requirePermission(rbacRepo, 'tenant.read'),
    async (request, response) => response.json(await tenants.get(String(request.params.tenantId))),
  );
  router.patch(
    '/tenants/:tenantId',
    auth,
    lifecycleScoped,
    requirePermission(rbacRepo, 'tenant.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']),
          reason: z.string().min(3).max(500),
        })
        .strict()
        .parse(request.body);
      response.json(
        await tenantIdempotent(governance, request, 'tenant.status.update', body, () =>
          tenants.updateStatus({
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
    '/tenants/:tenantId/invitations',
    auth,
    scoped,
    requirePermission(rbacRepo, 'member.invite'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          type: z.enum(['DIRECT', 'GROUP_LINK']),
          roleId: z.string().uuid(),
          branchId: z.string().uuid().nullable().optional(),
          maxUses: z.number().int().positive().max(1000).optional(),
          expiresAt: z.coerce.date(),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'invitation.create', body, () =>
          invitations.create({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            invitationType: body.type,
            roleId: body.roleId,
            branchId: body.branchId ?? undefined,
            maxUses: body.maxUses,
            expiresAt: body.expiresAt,
            correlationId: request.header('x-correlation-id')!,
          }),
        ),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/invitations',
    auth,
    scoped,
    requirePermission(rbacRepo, 'member.invite'),
    async (request: AuthenticatedRequest, response) =>
      response.json(await invitations.list(request.tenant!.tenantId)),
  );
  router.post(
    '/tenants/:tenantId/invitations/:invitationId/revoke',
    auth,
    scoped,
    requirePermission(rbacRepo, 'member.invite'),
    async (request: AuthenticatedRequest, response) =>
      response.json(
        await tenantIdempotent(
          governance,
          request,
          'invitation.revoke',
          { invitationId: request.params.invitationId },
          () =>
            invitations.revoke(
              request.tenant!.tenantId,
              String(request.params.invitationId),
              request.tenant!.membershipId,
              request.header('x-correlation-id')!,
            ),
        ),
      ),
  );
  return router;
}
