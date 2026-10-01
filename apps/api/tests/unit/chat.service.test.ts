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
      async withMedia(_tenant: string, items: Array<Record<string, unknown>>) {
        return items.map((item) => ({ ...item, media: null }));
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

  it('maps own READY media to a typed message and rejects foreign or pending media', async () => {
    const created: Array<Record<string, unknown>> = [];
    const mediaById = new Map([
      ['media-image', { id: 'media-image', ownerMembershipId: 'member-1', contentType: 'image/jpeg', status: 'READY' }],
      ['media-voice', { id: 'media-voice', ownerMembershipId: 'member-1', contentType: 'audio/mp4', status: 'READY' }],
      ['media-pending', { id: 'media-pending', ownerMembershipId: 'member-1', contentType: 'image/png', status: 'PENDING_UPLOAD' }],
      ['media-foreign', { id: 'media-foreign', ownerMembershipId: 'member-2', contentType: 'image/png', status: 'READY' }],
    ]);
    const chatRepo = {
      async listChannels() {
        return [{ id: 'channel-1' }];
      },
      async findMessageByClientId() {
        return null;
      },
      async getMedia(_tenant: string, mediaId: string) {
        return mediaById.get(mediaId) ?? null;
      },
      async createMessage(input: Record<string, unknown>) {
        const value = { id: `message-${created.length + 1}`, ...input };
        created.push(value);
        return value;
      },
      async withMedia(_tenant: string, items: Array<Record<string, unknown>>) {
        return items.map((item) => ({ ...item, media: null }));
      },
    } as unknown as ChatNotificationsRepository;
    const service = new ChatService(
      chatRepo,
      {
        async getMembership() {
          return { membershipDisplayName: 'Nguyễn A' };
        },
      } as unknown as OrganizationRbacRepository,
      new InMemoryRealtime(),
    );
    const base = {
      tenantId: 'tenant-1',
      channelId: 'channel-1',
      actorMembershipId: 'member-1',
      body: '',
    };

    const image = await service.send({ ...base, clientMessageId: 'client-image', mediaId: 'media-image' });
    const voice = await service.send({ ...base, clientMessageId: 'client-voice', mediaId: 'media-voice' });
    expect(image.messageType).toBe('IMAGE');
    expect(voice.messageType).toBe('AUDIO');
    expect(created[1]!.mediaId).toBe('media-voice');

    await expect(
      service.send({ ...base, clientMessageId: 'client-missing', mediaId: 'media-nope' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.send({ ...base, clientMessageId: 'client-foreign', mediaId: 'media-foreign' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.send({ ...base, clientMessageId: 'client-pending', mediaId: 'media-pending' }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
