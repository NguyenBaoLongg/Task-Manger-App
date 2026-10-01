import type { DatabaseClient } from './client.js';
import type { ChatMessage } from './generated/prisma/client.js';
import { ProblemError } from '@adsup/domain';
import { decodeTimeCursor, encodeTimeCursor } from './cursor.js';

export type ChatMessageMedia = {
  mediaId: string;
  contentType: string;
  byteSize: number;
  durationMs: number | null;
};
export type ChatMessageWithMedia = ChatMessage & { media: ChatMessageMedia | null };

export class ChatNotificationsRepository {
  constructor(private readonly db: DatabaseClient) {}
  /**
   * A conversation list needs more than the channel row: which message was last, who wrote it, and
   * how many the caller has not read. Without those a client can only render names, which is why the
   * mobile chat tab previously jumped straight into the first channel.
   *
   * Ordering is by last activity rather than creation, because a conversation list is only useful
   * when the channel someone just wrote in is at the top.
   *
   * The per-channel queries are issued together. Channel counts here are in the tens — a member
   * belongs to their branch channel, the tenant general channel and a handful of groups — so the
   * clarity is worth more than folding this into one hand-written aggregate.
   */
  async listChannels(tenantId: string, membershipId: string) {
    const memberships = await this.db.chatChannelMembership.findMany({
      where: { tenantId, membershipId, leftAt: null },
      select: { channelId: true, lastReadMessageId: true },
    });
    const lastReadByChannel = new Map(
      memberships.map((item) => [item.channelId, item.lastReadMessageId]),
    );
    const channels = await this.db.chatChannel.findMany({
      where: {
        tenantId,
        OR: [{ type: 'TENANT_GENERAL' }, { id: { in: memberships.map((item) => item.channelId) } }],
      },
    });

    const decorated = await Promise.all(
      channels.map(async (channel) => {
        const lastMessage = await this.db.chatMessage.findFirst({
          where: { tenantId, channelId: channel.id, deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });

        // A membership row carries the read marker. `TENANT_GENERAL` is visible without one, so a
        // missing marker means nothing has been read and every message counts as unread.
        const lastReadMessageId = lastReadByChannel.get(channel.id) ?? null;
        const lastRead = lastReadMessageId
          ? await this.db.chatMessage.findUnique({
              where: { tenantId_id: { tenantId, id: lastReadMessageId } },
              select: { createdAt: true },
            })
          : null;

        const unreadCount = await this.db.chatMessage.count({
          where: {
            tenantId,
            channelId: channel.id,
            deletedAt: null,
            // Messages the caller wrote are never unread to the caller.
            authorMembershipId: { not: membershipId },
            ...(lastRead ? { createdAt: { gt: lastRead.createdAt } } : {}),
          },
        });

        // A DM is labelled for the viewer: each side sees the other person's name, not the stored
        // (empty) channel name.
        let name = channel.name;
        if (channel.type === 'DIRECT') {
          const peer = await this.db.chatChannelMembership.findFirst({
            where: {
              tenantId,
              channelId: channel.id,
              membershipId: { not: membershipId },
              leftAt: null,
            },
            select: { membershipId: true },
          });
          if (peer) {
            const peerMembership = await this.db.tenantMembership.findUnique({
              where: { tenantId_id: { tenantId, id: peer.membershipId } },
              select: { membershipDisplayName: true },
            });
            name = peerMembership?.membershipDisplayName ?? name;
          }
        }

        return {
          ...channel,
          name,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                messageType: lastMessage.messageType,
                authorMembershipId: lastMessage.authorMembershipId,
                authorDisplayName: lastMessage.authorDisplayNameSnapshot,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
          lastActivityAt: lastMessage?.createdAt ?? channel.createdAt,
        };
      }),
    );

    return decorated.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }

  /**
   * Moves the caller's read marker to a message they have seen. The marker only ever moves forward:
   * reopening an older conversation must not resurrect unread counts that were already cleared.
   */
  async markChannelRead(tenantId: string, membershipId: string, channelId: string) {
    const latest = await this.db.chatMessage.findFirst({
      where: { tenantId, channelId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!latest) return { lastReadMessageId: null };

    await this.db.chatChannelMembership.updateMany({
      where: { tenantId, channelId, membershipId, leftAt: null },
      data: { lastReadMessageId: latest.id },
    });
    return { lastReadMessageId: latest.id };
  }
  createChannel(data: {
    tenantId: string;
    type: 'BRANCH' | 'GROUP' | 'DIRECT';
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
      if (data.type === 'DIRECT') {
        const others = [
          ...new Set(data.membershipIds.filter((id) => id !== data.createdByMembershipId)),
        ];
        const other = others[0];
        if (others.length !== 1 || !other)
          throw new ProblemError(422, 'VALIDATION_FAILED', 'Tin nhắn riêng cần đúng một thành viên.');
        const mine = await tx.chatChannelMembership.findMany({
          where: { tenantId: data.tenantId, membershipId: data.createdByMembershipId, leftAt: null },
          select: { channelId: true },
        });
        if (mine.length) {
          const shared = await tx.chatChannelMembership.findMany({
            where: {
              tenantId: data.tenantId,
              membershipId: other,
              leftAt: null,
              channelId: { in: mine.map((row) => row.channelId) },
            },
            select: { channelId: true },
          });
          const existing = shared.length
            ? await tx.chatChannel.findFirst({
                where: {
                  tenantId: data.tenantId,
                  type: 'DIRECT',
                  id: { in: shared.map((row) => row.channelId) },
                },
              })
            : null;
          // A pair has exactly one DM: a second request reopens the existing channel instead of
          // forking the history into a new one.
          if (existing) return existing;
        }
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
  async listChannelMembers(tenantId: string, channelId: string) {
    const rows = await this.db.chatChannelMembership.findMany({
      where: { tenantId, channelId, leftAt: null },
      select: { membershipId: true, role: true },
    });
    const memberships = rows.length
      ? await this.db.tenantMembership.findMany({
          where: { tenantId, id: { in: rows.map((row) => row.membershipId) } },
          select: { id: true, membershipDisplayName: true },
        })
      : [];
    const names = new Map(memberships.map((item) => [item.id, item.membershipDisplayName]));
    return rows
      .map((row) => ({
        membershipId: row.membershipId,
        displayName: names.get(row.membershipId) ?? '',
        role: row.role,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
    return {
      items: await this.withMedia(tenantId, items),
      nextCursor:
        hasMore && items.at(-1)
          ? encodeTimeCursor(items.at(-1)!.createdAt, items.at(-1)!.id)
          : null,
    };
  }
  /**
   * Media bubbles need the attachment's kind, size and (for voice notes) duration. Media rows are
   * fetched once per page instead of per message: a page holds at most 100 messages.
   */
  async withMedia(
    tenantId: string,
    messages: ChatMessage[],
  ): Promise<ChatMessageWithMedia[]> {
    const mediaIds = [...new Set(messages.map((item) => item.mediaId).filter(Boolean))] as string[];
    const mediaRows = mediaIds.length
      ? await this.db.mediaObject.findMany({
          where: { tenantId, id: { in: mediaIds } },
          select: { id: true, contentType: true, byteSize: true, durationMs: true },
        })
      : [];
    const mediaById = new Map(
      mediaRows.map((row) => [
        row.id,
        {
          mediaId: row.id,
          contentType: row.contentType,
          byteSize: Number(row.byteSize),
          durationMs: row.durationMs ?? null,
        } satisfies ChatMessageMedia,
      ]),
    );
    return messages.map((item) => ({ ...item, media: item.mediaId ? mediaById.get(item.mediaId) ?? null : null }));
  }
  createMessage(data: {
    tenantId: string;
    channelId: string;
    authorMembershipId: string;
    authorDisplayNameSnapshot: string;
    clientMessageId: string;
    body: string;
    messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
    mediaId?: string | null;
    replyToMessageId?: string;
  }) {
    return this.db.chatMessage.create({ data });
  }
  getMedia(tenantId: string, mediaId: string) {
    return this.db.mediaObject.findUnique({
      where: { tenantId_id: { tenantId, id: mediaId } },
      select: { id: true, ownerMembershipId: true, contentType: true, status: true },
    });
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
