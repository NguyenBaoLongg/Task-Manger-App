import type { DatabaseClient } from './client.js';
import { ProblemError } from '@adsup/domain';
import { decodeTimeCursor, encodeTimeCursor } from './cursor.js';

export class ChatNotificationsRepository {
  constructor(private readonly db: DatabaseClient) {}
  async listChannels(tenantId: string, membershipId: string) {
    const memberships = await this.db.chatChannelMembership.findMany({
      where: { tenantId, membershipId, leftAt: null },
      select: { channelId: true },
    });
    return this.db.chatChannel.findMany({
      where: {
        tenantId,
        OR: [{ type: 'TENANT_GENERAL' }, { id: { in: memberships.map((item) => item.channelId) } }],
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  createChannel(data: {
    tenantId: string;
    type: 'BRANCH' | 'GROUP';
    name: string;
    branchId?: string | null;
    membershipIds: string[];
    createdByMembershipId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      if (data.type === 'BRANCH') {
        if (!data.branchId)
          throw new ProblemError(422, 'VALIDATION_FAILED', 'Kênh cơ sở phải có branchId.');
        const branch = await tx.branch.findUnique({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.branchId } },
        });
        if (!branch || branch.status !== 'ACTIVE')
          throw new ProblemError(409, 'CONFLICT', 'Cơ sở của kênh không còn hoạt động.');
      }
      const membershipIds = [...new Set([data.createdByMembershipId, ...data.membershipIds])];
      const activeCount = await tx.tenantMembership.count({
        where: { tenantId: data.tenantId, id: { in: membershipIds }, status: 'ACTIVE' },
      });
      if (activeCount !== membershipIds.length)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Có thành viên kênh không hợp lệ.');
      const channel = await tx.chatChannel.create({
        data: {
          tenantId: data.tenantId,
          type: data.type,
          name: data.name,
          branchId: data.branchId,
          createdByMembershipId: data.createdByMembershipId,
        },
      });
      await tx.chatChannelMembership.createMany({
        data: membershipIds.map((membershipId) => ({
          tenantId: data.tenantId,
          channelId: channel.id,
          membershipId,
          role: membershipId === data.createdByMembershipId ? 'MODERATOR' : 'MEMBER',
        })),
      });
      return channel;
    });
  }
  getChannel(tenantId: string, channelId: string) {
    return this.db.chatChannel.findUnique({ where: { tenantId_id: { tenantId, id: channelId } } });
  }
  async listMessages(tenantId: string, channelId: string, cursor?: string, take = 50) {
    const decoded = decodeTimeCursor(cursor);
    const items = await this.db.chatMessage.findMany({
      where: {
        tenantId,
        channelId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.timestamp } },
                { createdAt: decoded.timestamp, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(take, 100) + 1,
    });
    const hasMore = items.length > Math.min(take, 100);
    if (hasMore) items.pop();
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeTimeCursor(last.createdAt, last.id) : null,
    };
  }
  createMessage(data: {
    tenantId: string;
    channelId: string;
    authorMembershipId: string;
    authorDisplayNameSnapshot: string;
    clientMessageId: string;
    body: string;
    replyToMessageId?: string;
  }) {
    return this.db.chatMessage.create({ data });
  }
  findMessageByClientId(tenantId: string, authorMembershipId: string, clientMessageId: string) {
    return this.db.chatMessage.findUnique({
      where: {
        tenantId_authorMembershipId_clientMessageId: {
          tenantId,
          authorMembershipId,
          clientMessageId,
        },
      },
    });
  }
  registerEndpoint(data: {
    userId: string;
    platform: 'IOS' | 'ANDROID';
    provider: 'FCM' | 'APNS';
    tokenCiphertext: string;
    tokenFingerprint: string;
  }) {
    return this.db.notificationEndpoint.upsert({
      where: {
        userId_tokenFingerprint: { userId: data.userId, tokenFingerprint: data.tokenFingerprint },
      },
      update: {
        status: 'ACTIVE',
        revokedAt: null,
        lastSeenAt: new Date(),
        tokenCiphertext: data.tokenCiphertext,
      },
      create: { ...data, lastSeenAt: new Date() },
    });
  }
  async selectActiveEndpoints(userIds: string[]) {
    const endpoints = await this.db.notificationEndpoint.findMany({
      where: { userId: { in: [...new Set(userIds)] }, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });
    if (endpoints.length)
      await this.db.notificationEndpoint.updateMany({
        where: { id: { in: endpoints.map((endpoint) => endpoint.id) }, status: 'ACTIVE' },
        data: { lastSeenAt: new Date() },
      });
    return endpoints;
  }
  revokeEndpoint(userId: string, endpointId: string) {
    return this.db.notificationEndpoint.updateMany({
      where: { id: endpointId, userId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }
}
