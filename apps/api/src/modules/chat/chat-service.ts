import { ProblemError, type RealtimePort } from '@adsup/domain';
import type {
  ChatChannel,
  ChatNotificationsRepository,
  ChatMessageWithMedia,
  OrganizationRbacRepository,
} from '@adsup/database';

export class ChatService {
  constructor(
    private readonly repository: ChatNotificationsRepository,
    private readonly organization: OrganizationRbacRepository,
    private readonly realtime: RealtimePort,
  ) {}
  listChannels(tenantId: string, membershipId: string): Promise<ChatChannel[]> {
    return this.repository.listChannels(tenantId, membershipId);
  }
  createChannel(input: {
    tenantId: string;
    type: 'BRANCH' | 'GROUP' | 'DIRECT';
    name?: string;
    branchId?: string | null;
    membershipIds: string[];
    actorMembershipId: string;
  }): Promise<ChatChannel> {
    return this.repository.createChannel({
      tenantId: input.tenantId,
      type: input.type,
      name: input.name?.trim() ?? '',
      branchId: input.branchId,
      membershipIds: input.membershipIds,
      createdByMembershipId: input.actorMembershipId,
    });
  }
  listChannelMembers(tenantId: string, membershipId: string, channelId: string) {
    return this.assertChannel(tenantId, membershipId, channelId).then(() =>
      this.repository.listChannelMembers(tenantId, channelId),
    );
  }
  listMessages(tenantId: string, membershipId: string, channelId: string, cursor?: string) {
    return this.assertChannel(tenantId, membershipId, channelId).then(() =>
      this.repository.listMessages(tenantId, channelId, cursor),
    );
  }
  async markRead(tenantId: string, membershipId: string, channelId: string) {
    await this.assertChannel(tenantId, membershipId, channelId);
    return this.repository.markChannelRead(tenantId, membershipId, channelId);
  }
  async send(input: {
    tenantId: string;
    channelId: string;
    actorMembershipId: string;
    clientMessageId: string;
    body: string;
    mediaId?: string;
    replyToMessageId?: string;
  }): Promise<ChatMessageWithMedia> {
    await this.assertChannel(input.tenantId, input.actorMembershipId, input.channelId);
    const media = input.mediaId ? await this.resolveOwnMedia(input.tenantId, input.actorMembershipId, input.mediaId) : null;
    const replay = await this.repository.findMessageByClientId(
      input.tenantId,
      input.actorMembershipId,
      input.clientMessageId,
    );
    if (replay) {
      if (
        replay.channelId !== input.channelId ||
        replay.body !== input.body.trim() ||
        (replay.mediaId ?? null) !== (input.mediaId ?? null) ||
        (replay.replyToMessageId ?? null) !== (input.replyToMessageId ?? null)
      )
        throw new ProblemError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'clientMessageId đã dùng cho nội dung khác.',
        );
      return (await this.repository.withMedia(input.tenantId, [replay]))[0]!;
    }
    const membership = await this.organization.getMembership(
      input.tenantId,
      input.actorMembershipId,
    );
    if (!membership)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy thành viên.');
    let message;
    let created = true;
    try {
      message = await this.repository.createMessage({
        tenantId: input.tenantId,
        channelId: input.channelId,
        authorMembershipId: input.actorMembershipId,
        authorDisplayNameSnapshot: membership.membershipDisplayName,
        clientMessageId: input.clientMessageId,
        body: input.body.trim(),
        ...(media ? { messageType: messageTypeFor(media.contentType), mediaId: media.id } : {}),
        replyToMessageId: input.replyToMessageId,
      });
    } catch (error) {
      const raced = await this.repository.findMessageByClientId(
        input.tenantId,
        input.actorMembershipId,
        input.clientMessageId,
      );
      if (!raced) throw error;
      if (
        raced.channelId !== input.channelId ||
        raced.body !== input.body.trim() ||
        (raced.mediaId ?? null) !== (input.mediaId ?? null) ||
        (raced.replyToMessageId ?? null) !== (input.replyToMessageId ?? null)
      )
        throw new ProblemError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'clientMessageId đã dùng cho nội dung khác.',
        );
      message = raced;
      created = false;
    }
    const [presented] = await this.repository.withMedia(input.tenantId, [message]);
    if (created)
      await this.realtime.publish(
        `tenant:${input.tenantId}:channel:${input.channelId}`,
        'message:created',
        presented,
      );
    return presented!;
  }
  /**
   * Attachments must be an upload the sender finished themselves. Anything else (someone else's
   * media, still-pending uploads, foreign ids) is reported as not found so ids cannot be probed.
   */
  private async resolveOwnMedia(tenantId: string, actorMembershipId: string, mediaId: string) {
    const media = await this.repository.getMedia(tenantId, mediaId);
    if (!media || media.ownerMembershipId !== actorMembershipId)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy media.');
    if (media.status !== 'READY')
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Media chưa tải lên xong.');
    return media;
  }
  private async assertChannel(
    tenantId: string,
    membershipId: string,
    channelId: string,
  ): Promise<ChatChannel> {
    const channels = await this.repository.listChannels(tenantId, membershipId);
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy kênh.');
    return channel;
  }
}

function messageTypeFor(contentType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' {
  if (contentType.startsWith('image/')) return 'IMAGE';
  if (contentType.startsWith('video/')) return 'VIDEO';
  if (contentType.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}
