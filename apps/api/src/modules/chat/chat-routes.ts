import { Router } from 'express';
import { z } from 'zod';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { ChatService } from './chat-service.js';
import { ProblemError } from '@adsup/domain';
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
    async (request: AuthenticatedRequest, response) => {
      const body = z
        .object({
          type: z.enum(['BRANCH', 'GROUP', 'DIRECT']),
          name: z.string().min(2).max(120).optional(),
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
        .superRefine((value, ctx) => {
          if (value.type !== 'DIRECT' && (value.name === undefined || value.name.trim().length < 2))
            ctx.addIssue({
              code: 'custom',
              path: ['name'],
              message: 'name is required for BRANCH and GROUP channels',
            });
        })
        .parse(request.body);
      // Any ACTIVE member may open a GROUP chat; curated BRANCH channels still require chat.manage.
      if (body.type === 'BRANCH') {
        const allowed = await rbacRepo.hasPermission(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          'chat.manage',
          body.branchId ?? undefined,
        );
        if (!allowed)
          throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Không có quyền tạo kênh chi nhánh.');
      }
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
    '/tenants/:tenantId/channels/:channelId/members',
    auth,
    scoped,
    requirePermission(rbacRepo, 'chat.read'),
    async (request: AuthenticatedRequest, response) =>
      response.json(
        await service.listChannelMembers(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          String(request.params.channelId),
        ),
      ),
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
  // Clearing an unread badge is a read-side act on a channel the caller can already read, so it is
  // gated by `chat.read` rather than `chat.write`. It moves only the caller's own marker.
  router.post(
    '/tenants/:tenantId/channels/:channelId/read',
    auth,
    scoped,
    requirePermission(rbacRepo, 'chat.read'),
    async (request: AuthenticatedRequest, response) =>
      response.json(
        await service.markRead(
          request.tenant!.tenantId,
          request.tenant!.membershipId,
          String(request.params.channelId),
        ),
      ),
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
          body: z.string().max(4000).optional(),
          mediaId: z.string().uuid().optional(),
          replyToMessageId: z.string().uuid().optional(),
        })
        .strict()
        .superRefine((value, ctx) => {
          if (!value.mediaId && (value.body === undefined || value.body.trim().length < 1))
            ctx.addIssue({
              code: 'custom',
              path: ['body'],
              message: 'body is required when the message has no mediaId',
            });
        })
        .parse(request.body);
      const message = await tenantIdempotent(governance, request, 'chat-message.create', body, () =>
        service.send({
          tenantId: request.tenant!.tenantId,
          channelId: String(request.params.channelId),
          actorMembershipId: request.tenant!.membershipId,
          clientMessageId: body.clientMessageId,
          body: body.body ?? '',
          mediaId: body.mediaId,
          replyToMessageId: body.replyToMessageId,
        }),
      );
      response
        .status(201)
        .json({ ...message, authorDisplayName: message.authorDisplayNameSnapshot });
    },
  );
  return router;
}
