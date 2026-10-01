import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;

export type UploadIntentResult = {
  media?: { id?: string };
  upload?: { url?: string; requiredHeaders?: Record<string, string>; expiresAt?: string };
};

export const createUploadIntent = (
  client: ApiClient,
  tenantId: string,
  input: {
    purpose: string;
    contentType: string;
    byteSize: number;
    durationMs?: number;
    checksumSha256: string;
    idempotencyKey: string;
  },
) =>
  client.tenant(tenantId).request<UploadIntentResult>('/media/upload-intents', {
    method: 'POST',
    body: {
      purpose: input.purpose,
      contentType: input.contentType,
      byteSize: input.byteSize,
      ...(input.durationMs ? { durationMs: input.durationMs } : {}),
      checksumSha256: input.checksumSha256,
    },
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
