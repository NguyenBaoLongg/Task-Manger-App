import type { ChatNotificationsRepository } from '@adsup/database';

export interface BookingReportDeliveryPort {
  send(input: {
    tenantId: string;
    channelId: string;
    dedupeKey: string;
    body: string;
  }): Promise<{ messageId: string }>;
}

export class ChatBookingReportDelivery implements BookingReportDeliveryPort {
  constructor(private readonly chat: ChatNotificationsRepository) {}

  async send(input: { tenantId: string; channelId: string; dedupeKey: string; body: string }) {
    const channel = await this.chat.getChannel(input.tenantId, input.channelId);
    if (!channel || channel.status !== 'ACTIVE') throw new Error('REPORT_CHANNEL_UNAVAILABLE');
    const message = await this.chat.createMessage({
      tenantId: input.tenantId,
      channelId: input.channelId,
      authorMembershipId: channel.createdByMembershipId,
      authorDisplayNameSnapshot: 'Adsup Bot',
      clientMessageId: input.dedupeKey,
      body: input.body,
    });
    return { messageId: message.id };
  }
}
