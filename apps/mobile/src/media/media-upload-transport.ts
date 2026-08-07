import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const createUploadIntent = (
  client: ApiClient,
  tenantId: string,
  input: { purpose: string; checksum: string; sizeBytes: number; idempotencyKey: string },
) =>
  client.tenant(tenantId).request('/media/upload-intents', {
    method: 'POST',
    body: input,
    idempotencyKey: input.idempotencyKey,
  });
export const completeUpload = (
  client: ApiClient,
  tenantId: string,
  mediaId: string,
  input: { checksum: string; idempotencyKey: string },
) =>
  client.tenant(tenantId).request(`/media/${encodeURIComponent(mediaId)}/complete`, {
    method: 'POST',
    body: { checksum: input.checksum },
    idempotencyKey: input.idempotencyKey,
  });
