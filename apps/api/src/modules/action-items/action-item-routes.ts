import { Router } from 'express';
import { z } from 'zod';
import { businessDateSchema } from '@adsup/contracts';
import type { AuthTenantsRepository, OrganizationRbacRepository } from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { ActionItemService } from './action-item-service.js';
import {
  authenticate,
  requireAnyScopedPermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { kpiJsonSafe } from '../kpi/kpi-http.js';

export function actionItemRoutes(
  tokens: TokenService,
  service: ActionItemService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
): Router {
  const router = Router();
  router.get(
    '/tenants/:tenantId/action-items',
    authenticate(tokens),
    tenantContext(authRepo),
    requireAnyScopedPermission(rbacRepo, 'kpi.view'),
    async (request: AuthenticatedRequest, response) => {
      const query = z
        .object({
          state: z.enum(['OPEN', 'OVERDUE', 'COMPLETED', 'DISMISSED']).optional(),
          businessDate: businessDateSchema.optional(),
          cursor: z.string().max(1024).optional(),
        })
        .parse(request.query);
      response.json(
        kpiJsonSafe(
          await service.listMine({
            tenantId: request.tenant!.tenantId,
            membershipId: request.tenant!.membershipId,
            state: query.state,
            cursor: query.cursor,
            businessDate: query.businessDate
              ? new Date(`${query.businessDate}T00:00:00.000Z`)
              : undefined,
          }),
        ),
      );
    },
  );
  return router;
}
