import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const listChannels = (client: ApiClient, tenantId: string) =>
  client.tenant(tenantId).request('/channels');
export const listMessages = (
  client: ApiClient,
  tenantId: string,
  channelId: string,
  cursor?: string,
) =>
  client
    .tenant(tenantId)
    .request(
      `/channels/${encodeURIComponent(channelId)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
export const markChannelRead = (client: ApiClient, tenantId: string, channelId: string) =>
  client
    .tenant(tenantId)
    .request(`/channels/${encodeURIComponent(channelId)}/read`, { method: 'POST' });
export const sendMessage = (
  client: ApiClient,
  tenantId: string,
  channelId: string,
  input: { clientMessageId: string; body: string; mediaId?: string; idempotencyKey: string },
) =>
  client.tenant(tenantId).request(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    body: {
      clientMessageId: input.clientMessageId,
      body: input.body,
      ...(input.mediaId ? { mediaId: input.mediaId } : {}),
    },
    idempotencyKey: input.idempotencyKey,
  });

export type ChannelMember = { membershipId: string; displayName: string; role: string };

export const listChannelMembers = (client: ApiClient, tenantId: string, channelId: string) =>
  client
    .tenant(tenantId)
    .request<ChannelMember[]>(`/channels/${encodeURIComponent(channelId)}/members`);

/**
 * Opens the 1-1 conversation with one other member. The backend returns the existing DIRECT
 * channel when the pair already has one, so repeated taps never fork the history.
 */
export const startDirectMessage = (
  client: ApiClient,
  tenantId: string,
  otherMembershipId: string,
) =>
  client.tenant(tenantId).request<{ id: string }>('/channels', {
    method: 'POST',
    body: { type: 'DIRECT', membershipIds: [otherMembershipId] },
    idempotencyKey: `dm-${otherMembershipId.slice(0, 12)}`,
  });
