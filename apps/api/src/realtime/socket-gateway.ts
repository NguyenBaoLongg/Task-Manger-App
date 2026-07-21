import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { AuthTenantsRepository, ChatNotificationsRepository } from '@adsup/database';
import type { TokenService } from '../modules/auth/token-service.js';
import type { ChatService } from '../modules/chat/chat-service.js';

export const channelRoom = (tenantId: string, channelId: string) =>
  `tenant:${tenantId}:channel:${channelId}`;
export const membershipRoom = (tenantId: string, membershipId: string) =>
  `tenant:${tenantId}:membership:${membershipId}`;

const channelInput = z.object({ tenantId: z.string().uuid(), channelId: z.string().uuid() });
const messageInput = channelInput.extend({
  clientMessageId: z.string().min(8).max(100),
  body: z.string().min(1).max(4000),
});

export function createSocketGateway(
  http: HttpServer,
  tokens: TokenService,
  authRepo: AuthTenantsRepository,
  chatRepo: ChatNotificationsRepository,
  chat: ChatService,
  telemetry?: { increment(name: string): void },
) {
  const io = new Server(http, {
    cors: { origin: false },
    connectionStateRecovery: { maxDisconnectionDuration: 120_000, skipMiddlewares: false },
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) throw new Error('missing');
      socket.data.principal = await tokens.verifyAccess(token);
      next();
    } catch {
      next(new Error('AUTHENTICATION_REQUIRED'));
    }
  });
  io.on('connection', async (socket) => {
    telemetry?.increment('realtime_connections_total');
    socket.once('disconnect', () => telemetry?.increment('realtime_disconnections_total'));
    try {
      const memberships = await authRepo.listTenants(socket.data.principal.userId as string);
      for (const { membership, tenant } of memberships) {
        if (membership.status === 'ACTIVE' && tenant.status === 'ACTIVE') {
          await socket.join(membershipRoom(membership.tenantId, membership.id));
        }
      }
    } catch {
      socket.disconnect(true);
      return;
    }
    socket.on(
      'channel:join',
      async (
        input: { tenantId: string; channelId: string },
        acknowledge: (result: unknown) => void,
      ) => {
        try {
          const parsed = channelInput.parse(input);
          const membership = await authRepo.findMembership(
            parsed.tenantId,
            socket.data.principal.userId as string,
          );
          if (!membership || membership.status !== 'ACTIVE') throw new Error('denied');
          const channels = await chatRepo.listChannels(parsed.tenantId, membership.id);
          if (!channels.some((item) => item.id === parsed.channelId)) throw new Error('denied');
          await socket.join(channelRoom(parsed.tenantId, parsed.channelId));
          acknowledge({ ok: true });
        } catch (error) {
          acknowledge({
            ok: false,
            code: error instanceof z.ZodError ? 'VALIDATION_FAILED' : 'AUTHORIZATION_DENIED',
          });
        }
      },
    );
    socket.on(
      'message:send',
      async (
        input: { tenantId: string; channelId: string; clientMessageId: string; body: string },
        acknowledge: (result: unknown) => void,
      ) => {
        try {
          const parsed = messageInput.parse(input);
          const membership = await authRepo.findMembership(
            parsed.tenantId,
            socket.data.principal.userId as string,
          );
          if (!membership || membership.status !== 'ACTIVE') throw new Error('denied');
          acknowledge({
            ok: true,
            message: await chat.send({ ...parsed, actorMembershipId: membership.id }),
          });
        } catch (error) {
          acknowledge({
            ok: false,
            code: error instanceof z.ZodError ? 'VALIDATION_FAILED' : 'AUTHORIZATION_DENIED',
          });
        }
      },
    );
  });
  return io;
}
