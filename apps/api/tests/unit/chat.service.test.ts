import { describe, expect, it } from 'vitest';
import type { ChatNotificationsRepository, OrganizationRbacRepository } from '@adsup/database';
import { InMemoryRealtime } from '@adsup/testing';
import { ChatService } from '../../src/modules/chat/chat-service.js';

describe('chat idempotency and author snapshot', () => {
  it('persists once before emitting', async () => {
    const messages: Array<Record<string, unknown>> = [];
    const chatRepo = {
      async listChannels() {
        return [{ id: 'channel-1' }];
      },
      async findMessageByClientId(_tenant: string, _member: string, client: string) {
        return messages.find((item) => item.clientMessageId === client) ?? null;
      },
      async createMessage(input: Record<string, unknown>) {
        const value = { id: 'message-1', ...input };
        messages.push(value);
        return value;
      },
    } as unknown as ChatNotificationsRepository;
    const organization = {
      async getMembership() {
        return { membershipDisplayName: 'Nguyễn A' };
      },
    } as unknown as OrganizationRbacRepository;
    const realtime = new InMemoryRealtime();
    const service = new ChatService(chatRepo, organization, realtime);
    const input = {
      tenantId: 'tenant-1',
      channelId: 'channel-1',
      actorMembershipId: 'member-1',
      clientMessageId: 'client-1',
      body: 'Xin chào',
    };
    const first = await service.send(input);
    const replay = await service.send(input);
    expect(replay).toEqual(first);
    expect(messages).toHaveLength(1);
    expect(realtime.events).toHaveLength(1);
    expect(first.authorDisplayNameSnapshot).toBe('Nguyễn A');
  });
});
