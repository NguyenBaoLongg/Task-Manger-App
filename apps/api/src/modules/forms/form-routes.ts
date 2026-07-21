import { Router } from 'express';
import { z } from 'zod';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { FormService } from './form-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { readIdempotencyKey, tenantIdempotent } from '../../http/idempotency.js';

export function formRoutes(
  tokens: TokenService,
  service: FormService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.get(
    '/tenants/:tenantId/form-templates',
    auth,
    scoped,
    requirePermission(rbacRepo, 'form.read'),
    async (request: AuthenticatedRequest, response) =>
      response.json(await service.list(request.tenant!.tenantId)),
  );
  router.post(
    '/tenants/:tenantId/form-templates',
    auth,
    scoped,
    requirePermission(rbacRepo, 'form.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          code: z.string().min(2).max(80),
          name: z.string().min(2).max(160),
          description: z.string().max(1000).optional(),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'form-template.create', body, () =>
          service.create({
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
    '/tenants/:tenantId/form-templates/:templateId/publish',
    auth,
    scoped,
    requirePermission(rbacRepo, 'form.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          jsonSchema: z.record(z.string(), z.unknown()),
          uiSchema: z.record(z.string(), z.unknown()).optional(),
          effectiveFrom: z.coerce.date(),
          reason: z.string().min(3).max(500),
        })
        .strict()
        .parse(request.body);
      const version = await tenantIdempotent(
        governance,
        request,
        'form-version.publish',
        { templateId: request.params.templateId, ...body },
        () =>
          service.publish({
            tenantId: request.tenant!.tenantId,
            templateId: String(request.params.templateId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
      );
      response.status(201).json({ ...version, templateId: version.formTemplateId });
    },
  );
  router.post(
    '/tenants/:tenantId/form-templates/:templateId/archive',
    auth,
    scoped,
    requirePermission(rbacRepo, 'form.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({ reason: z.string().min(3).max(500) })
        .strict()
        .parse(request.body);
      response.json(
        await tenantIdempotent(
          governance,
          request,
          'form-template.archive',
          { templateId: request.params.templateId, ...body },
          () =>
            service.archiveTemplate({
              tenantId: request.tenant!.tenantId,
              templateId: String(request.params.templateId),
              actorMembershipId: request.tenant!.membershipId,
              correlationId: request.header('x-correlation-id')!,
              ...body,
            }),
        ),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/form-templates/:templateId/versions/:versionId/retire',
    auth,
    scoped,
    requirePermission(rbacRepo, 'form.manage'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({ reason: z.string().min(3).max(500) })
        .strict()
        .parse(request.body);
      const version = await tenantIdempotent(
        governance,
        request,
        'form-version.retire',
        { templateId: request.params.templateId, versionId: request.params.versionId, ...body },
        () =>
          service.retireVersion({
            tenantId: request.tenant!.tenantId,
            templateId: String(request.params.templateId),
            versionId: String(request.params.versionId),
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.header('x-correlation-id')!,
            ...body,
          }),
      );
      response.json({ ...version, templateId: version.formTemplateId });
    },
  );
  router.post(
    '/tenants/:tenantId/form-templates/:templateId/submissions',
    auth,
    scoped,
    requirePermission(
      rbacRepo,
      'form.submit',
      (request) => request.body?.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          formVersionId: z.string().uuid(),
          branchId: z.string().uuid().optional(),
          data: z.record(z.string(), z.unknown()),
        })
        .strict()
        .parse(request.body);
      const submission = await tenantIdempotent(
        governance,
        request,
        'form-submission.create',
        { templateId: request.params.templateId, ...body },
        () =>
          service.submit({
            tenantId: request.tenant!.tenantId,
            templateId: String(request.params.templateId),
            actorMembershipId: request.tenant!.membershipId,
            idempotencyKey: readIdempotencyKey(request),
            ...body,
          }),
      );
      response.status(201).json({ ...submission, templateId: submission.formTemplateId });
    },
  );
  return router;
}
