import { Router } from 'express';
import { z } from 'zod';
import { businessDateSchema, uuidSchema } from '@adsup/contracts';
import type { AuthTenantsRepository, OrganizationRbacRepository } from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { ActionItemManagementService } from './action-item-management-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { kpiJsonSafe } from '../kpi/kpi-http.js';

export function actionItemManagementRoutes(
  tokens: TokenService,
  service: ActionItemManagementService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
): Router {
  const router = Router();
  router.get(
    '/tenants/:tenantId/management/action-items',
    authenticate(tokens),
    tenantContext(authRepo),
    requirePermission(
      rbacRepo,
      'kpi.evaluation.view',
      (request) => request.query.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const query = z
        .object({
          branchId: uuidSchema.optional(),
          departmentId: uuidSchema.optional(),
          membershipId: uuidSchema.optional(),
          itemType: z
            .enum(['KPI_REPORT', 'KPI_SHORTFALL', 'PHOTO_DEBT', 'DATA_QUALITY'])
            .optional(),
          state: z.enum(['OPEN', 'OVERDUE', 'COMPLETED', 'DISMISSED']).optional(),
          from: businessDateSchema.optional(),
          to: businessDateSchema.optional(),
          cursor: z.string().max(1024).optional(),
        })
        .parse(request.query);
      response.json(
        kpiJsonSafe(
          await service.list({
            tenantId: request.tenant!.tenantId,
            ...query,
            from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
            to: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined,
          }),
        ),
      );
    },
  );
  return router;
}
