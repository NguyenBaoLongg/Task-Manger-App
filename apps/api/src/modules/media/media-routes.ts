import { Router } from 'express';
import { z } from 'zod';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { MediaService } from './media-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';

export function mediaRoutes(
  tokens: TokenService,
  service: MediaService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.post(
    '/tenants/:tenantId/media/upload-intents',
    auth,
    scoped,
    requirePermission(
      rbacRepo,
      'media.create',
      (request) => request.body?.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          branchId: z.string().uuid().nullable().optional(),
          sourceType: z.string().min(2).max(80).optional(),
          sourceId: z.string().uuid().nullable().optional(),
          purpose: z.string().min(2).max(50),
          contentType: z.enum([
            'image/jpeg',
            'image/png',
            'image/webp',
            'video/mp4',
            'application/pdf',
          ]),
          byteSize: z.number().int().positive().max(524_288_000),
          checksumSha256: z
            .string()
            .length(64)
            .regex(/^[0-9a-f]+$/i),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'media-upload-intent.create', body, () =>
          service.createIntent({
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
    '/tenants/:tenantId/media/:mediaId/complete',
    auth,
    scoped,
    requirePermission(rbacRepo, 'media.create'),
    async (request: AuthenticatedRequest, response) =>
      response.json(
        await tenantIdempotent(
          governance,
          request,
          'media-upload.complete',
          { mediaId: request.params.mediaId },
          () =>
            service.complete(
              request.tenant!.tenantId,
              String(request.params.mediaId),
              request.tenant!.membershipId,
              request.header('x-correlation-id')!,
            ),
        ),
      ),
  );
  router.post(
    '/tenants/:tenantId/media/:mediaId/download-url',
    auth,
    scoped,
    requirePermission(rbacRepo, 'media.read'),
    async (request: AuthenticatedRequest, response) =>
      response.json(
        await service.download(
          request.tenant!.tenantId,
          String(request.params.mediaId),
          request.tenant!.membershipId,
        ),
      ),
  );
  return router;
}
