import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';
import { createSocketGateway } from '../../src/realtime/socket-gateway.js';

const TENANT = '00000000-0000-4000-8000-000000000001';
const CHANNEL = '00000000-0000-4000-8000-000000000002';
const MEMBERSHIP = '00000000-0000-4000-8000-000000000003';
const USER = 'user-1';

type Ack = { ok: boolean; code?: string };

/**
 * The socket transport must apply the same RBAC gate as the HTTP routes.
 * `POST /tenants/:tenantId/channels/:channelId/messages` requires `chat.write` and
 * `GET .../messages` requires `chat.read`; a member whose role lacks those codes must not
 * be able to reach the same operations over WebSocket.
 */
const buildGateway = (granted: Set<string>) => {
  const http = createServer();
  const membership = { id: MEMBERSHIP, tenantId: TENANT, userId: USER, status: 'ACTIVE' };
  const tokens = {
    verifyAccess: async () => ({ userId: USER, sessionId: 'session-1' }),
  } as unknown as Parameters<typeof createSocketGateway>[1];
  const authRepo = {
    listTenants: async () => [{ membership, tenant: { id: TENANT, status: 'ACTIVE' } }],
    findMembership: async () => membership,
  } as unknown as Parameters<typeof createSocketGateway>[2];
  const chatRepo = {
    listChannels: async () => [{ id: CHANNEL }],
  } as unknown as Parameters<typeof createSocketGateway>[3];
  const sent: string[] = [];
  const chat = {
    send: async (input: { clientMessageId: string }) => {
      sent.push(input.clientMessageId);
      return { id: 'message-1' };
    },
  } as unknown as Parameters<typeof createSocketGateway>[4];
  const rbacRepo = {
    hasPermission: async (_tenantId: string, _membershipId: string, code: string) =>
      granted.has(code),
  } as unknown as Parameters<typeof createSocketGateway>[5];
  const server = createSocketGateway(http, tokens, authRepo, chatRepo, chat, rbacRepo);
  return { http, server, sent };
};

const connect = async (http: HttpServer): Promise<ClientSocket> => {
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const { port } = http.address() as AddressInfo;
  const client = createClient(`http://127.0.0.1:${port}`, {
    auth: { token: 'valid-token' },
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
  return client;
};

const emit = (client: ClientSocket, event: string, payload: unknown): Promise<Ack> =>
  new Promise((resolve) => client.emit(event, payload, resolve));

let open: { client?: ClientSocket; server?: SocketServer; http?: HttpServer } = {};

afterEach(async () => {
  open.client?.disconnect();
  await open.server?.close();
  await new Promise<void>((resolve) => open.http?.close(() => resolve()));
  open = {};
});

describe('chat socket RBAC', () => {
  it('denies message:send when the membership lacks chat.write', async () => {
    const { http, server, sent } = buildGateway(new Set(['chat.read']));
    const client = await connect(http);
    open = { client, server, http };

    const ack = await emit(client, 'message:send', {
      tenantId: TENANT,
      channelId: CHANNEL,
      clientMessageId: 'client-message-1',
      body: 'should not be stored',
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('AUTHORIZATION_DENIED');
    expect(sent).toEqual([]);
  });

  it('allows message:send when the membership holds chat.write', async () => {
    const { http, server, sent } = buildGateway(new Set(['chat.read', 'chat.write']));
    const client = await connect(http);
    open = { client, server, http };

    const ack = await emit(client, 'message:send', {
      tenantId: TENANT,
      channelId: CHANNEL,
      clientMessageId: 'client-message-2',
      body: 'stored',
    });

    expect(ack.ok).toBe(true);
    expect(sent).toEqual(['client-message-2']);
  });

  it('denies channel:join when the membership lacks chat.read', async () => {
    const { http, server } = buildGateway(new Set(['chat.write']));
    const client = await connect(http);
    open = { client, server, http };

    const ack = await emit(client, 'channel:join', { tenantId: TENANT, channelId: CHANNEL });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('AUTHORIZATION_DENIED');
  });

  it('allows channel:join when the membership holds chat.read', async () => {
    const { http, server } = buildGateway(new Set(['chat.read']));
    const client = await connect(http);
    open = { client, server, http };

    const ack = await emit(client, 'channel:join', { tenantId: TENANT, channelId: CHANNEL });

    expect(ack.ok).toBe(true);
  });
});
