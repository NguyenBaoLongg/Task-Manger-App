import { Router } from 'express';
import { z } from 'zod';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { ChatService } from './chat-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { tenantIdempotent } from '../../http/idempotency.js';

export function chatRoutes(
  tokens: TokenService,
  service: ChatService,
  authRepo: AuthTenantsRepository,
  rbacRepo: OrganizationRbacRepository,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  const scoped = tenantContext(authRepo);
  router.get(
    '/tenants/:tenantId/channels',
    auth,
    scoped,
    requirePermission(rbacRepo, 'chat.read'),
    async (request: AuthenticatedRequest, response) =>
      response.json(
        await service.listChannels(request.tenant!.tenantId, request.tenant!.membershipId),
      ),
  );
  router.post(
    '/tenants/:tenantId/channels',
    auth,
    scoped,
    requirePermission(
      rbacRepo,
      'chat.manage',
      (request) => request.body?.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          type: z.enum(['BRANCH', 'GROUP']),
          name: z.string().min(2).max(120),
          branchId: z.string().uuid().nullable().optional(),
          membershipIds: z
            .array(z.string().uuid())
            .max(500)
            .refine((items) => new Set(items).size === items.length, {
              message: 'membershipIds must be unique',
            })
            .default([]),
        })
        .strict()
        .parse(request.body);
      response.status(201).json(
        await tenantIdempotent(governance, request, 'chat-channel.create', body, () =>
          service.createChannel({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            ...body,
          }),
        ),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/channels/:channelId/messages',
    auth,
    scoped,
    requirePermission(rbacRepo, 'chat.read'),
    async (request: AuthenticatedRequest, response) => {
      const cursor = z.string().max(512).optional().parse(request.query.cursor);
      const page = await service.listMessages(
        request.tenant!.tenantId,
        request.tenant!.membershipId,
        String(request.params.channelId),
        cursor,
      );
      response.json({
        ...page,
        items: page.items.map((item) => ({
          ...item,
          authorDisplayName: item.authorDisplayNameSnapshot,
        })),
      });
    },
  );
  router.post(
    '/tenants/:tenantId/channels/:channelId/messages',
    auth,
    scoped,
    requirePermission(rbacRepo, 'chat.write'),
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          clientMessageId: z.string().min(8).max(100),
          body: z.string().min(1).max(4000),
          replyToMessageId: z.string().uuid().optional(),
        })
        .strict()
        .parse(request.body);
      const message = await tenantIdempotent(governance, request, 'chat-message.create', body, () =>
        service.send({
          tenantId: request.tenant!.tenantId,
          channelId: String(request.params.channelId),
          actorMembershipId: request.tenant!.membershipId,
          ...body,
        }),
      );
      response
        .status(201)
        .json({ ...message, authorDisplayName: message.authorDisplayNameSnapshot });
    },
  );
  return router;
}
