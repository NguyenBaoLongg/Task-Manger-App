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
export const sendMessage = (
  client: ApiClient,
  tenantId: string,
  channelId: string,
  input: { clientMessageId: string; body: string; idempotencyKey: string },
) =>
  client.tenant(tenantId).request(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    body: { clientMessageId: input.clientMessageId, body: input.body },
    idempotencyKey: input.idempotencyKey,
  });
