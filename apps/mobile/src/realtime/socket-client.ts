import { io, type Socket } from 'socket.io-client';
import type { TenantContext } from '@/tenant/tenant-context';

export const channelRoom = (tenantId: string, channelId: string) =>
  `tenant:${tenantId}:channel:${channelId}`;

type SocketOptions = {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  context: TenantContext;
  socketFactory?: typeof io;
};

export type MobileSocketClient = {
  connect: () => void;
  disconnect: () => void;
  joinChannel: (channelId: string, lastMessageId?: string | null) => Promise<unknown>;
  leaveChannel: (channelId: string) => void;
  on: (event: string, handler: (payload: unknown) => void) => () => void;
};

export const createSocketClient = ({
  baseUrl,
  getAccessToken,
  context,
  socketFactory = io,
}: SocketOptions): MobileSocketClient => {
  let socket: Socket | undefined;
  const connect = () => {
    socket = socketFactory(baseUrl, {
      auth: { token: getAccessToken() },
      transports: ['websocket'],
    });
    return undefined;
  };
  const activeSocket = () => {
    if (!socket) connect();
    return socket!;
  };
  const joinChannel = async (channelId: string, lastMessageId: string | null = null) => {
    const active = activeSocket();
    return new Promise<unknown>((resolve) => {
      active.emit(
        'channel:join',
        { tenantId: context.tenantId, channelId, lastMessageId },
        resolve,
      );
    });
  };
  const leaveChannel = (channelId: string) =>
    socket?.emit('channel:leave', { tenantId: context.tenantId, channelId });
  return {
    connect,
    disconnect: () => socket?.disconnect(),
    joinChannel,
    leaveChannel,
    on: (event: string, handler: (payload: unknown) => void) => {
      const active = activeSocket();
      active.on(event, (payload: unknown) => {
        if (typeof payload !== 'object' || payload === null) return;
        const value = payload as { tenantId?: string; branchId?: string };
        if (value.tenantId && value.tenantId !== context.tenantId) return;
        if (value.branchId && context.branchId && value.branchId !== context.branchId) return;
        handler(payload);
      });
      return () => active.off(event, handler);
    },
  };
};
