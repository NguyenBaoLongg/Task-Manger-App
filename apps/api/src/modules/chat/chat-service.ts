import { ProblemError, type RealtimePort } from '@adsup/domain';
import type {
  ChatChannel,
  ChatMessage,
  ChatNotificationsRepository,
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
    type: 'BRANCH' | 'GROUP';
    name: string;
    branchId?: string | null;
    membershipIds: string[];
    actorMembershipId: string;
  }): Promise<ChatChannel> {
    return this.repository.createChannel({
      tenantId: input.tenantId,
      type: input.type,
      name: input.name.trim(),
      branchId: input.branchId,
      membershipIds: input.membershipIds,
      createdByMembershipId: input.actorMembershipId,
    });
  }
  listMessages(tenantId: string, membershipId: string, channelId: string, cursor?: string) {
    return this.assertChannel(tenantId, membershipId, channelId).then(() =>
      this.repository.listMessages(tenantId, channelId, cursor),
    );
  }
  async send(input: {
    tenantId: string;
    channelId: string;
    actorMembershipId: string;
    clientMessageId: string;
    body: string;
    replyToMessageId?: string;
  }): Promise<ChatMessage> {
    await this.assertChannel(input.tenantId, input.actorMembershipId, input.channelId);
    const replay = await this.repository.findMessageByClientId(
      input.tenantId,
      input.actorMembershipId,
      input.clientMessageId,
    );
    if (replay) {
      if (
        replay.channelId !== input.channelId ||
        replay.body !== input.body.trim() ||
        (replay.replyToMessageId ?? null) !== (input.replyToMessageId ?? null)
      )
        throw new ProblemError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'clientMessageId đã dùng cho nội dung khác.',
        );
      return replay;
    }
    const membership = await this.organization.getMembership(
      input.tenantId,
      input.actorMembershipId,
    );
    if (!membership)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy thành viên.');
    let message: ChatMessage;
    let created = true;
    try {
      message = await this.repository.createMessage({
        tenantId: input.tenantId,
        channelId: input.channelId,
        authorMembershipId: input.actorMembershipId,
        authorDisplayNameSnapshot: membership.membershipDisplayName,
        clientMessageId: input.clientMessageId,
        body: input.body.trim(),
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
    if (created)
      await this.realtime.publish(
        `tenant:${input.tenantId}:channel:${input.channelId}`,
        'message:created',
        message,
      );
    return message;
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
