import { Router } from 'express';
import { z } from 'zod';
import type {
  AuditRepository,
  AuthTenantsRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';

export function auditRoutes(
  tokens: TokenService,
  repository: AuditRepository,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.get(
    '/tenants/:tenantId/audit-events',
    auth,
    scoped,
    requirePermission(rbacRepo, 'audit.read'),
    async (request: AuthenticatedRequest, response) => {
      const query = z
        .object({
          targetType: z.string().max(100).optional(),
          targetId: z.string().uuid().optional(),
          actorMembershipId: z.string().uuid().optional(),
          cursor: z.string().max(512).optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
        })
        .parse(request.query);
      const page = await repository.list(request.tenant!.tenantId, {
        targetType: query.targetType,
        targetId: query.targetId,
        actorMembershipId: query.actorMembershipId,
        cursor: query.cursor,
        take: query.limit,
      });
      response.json({
        ...page,
        items: page.items.map((item) => ({
          ...item,
          before: item.beforeRedacted,
          after: item.afterRedacted,
        })),
      });
    },
  );
  return router;
}
