import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import type { createApiClient } from '@/api/api-client';
import { completeUpload, createUploadIntent } from '@/media/media-upload-transport';

type ApiClient = ReturnType<typeof createApiClient>;

export type ChatMediaUpload = {
  uri: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'audio/mp4' | 'application/pdf';
  byteSize: number;
  durationMs?: number;
};

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const putMediaFile = (
  uri: string,
  uploadUrl: string,
  contentType: string,
  requiredHeaders: Record<string, string> | undefined,
  onProgress: (progressPercent: number) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    for (const [name, value] of Object.entries(requiredHeaders ?? {}))
      xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`UPLOAD_HTTP_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('UPLOAD_NETWORK'));
    // RN streams a file body from disk for { uri } payloads; a raw ArrayBuffer would
    // be dropped by the native networking module.
    xhr.send({ uri } as unknown as ArrayBuffer);
  });

/**
 * Full send-media lifecycle for a chat attachment: checksum, upload intent, presigned PUT,
 * and complete. Returns the mediaId to attach to a chat message.
 */
export const uploadChatMedia = async (
  client: ApiClient,
  tenantId: string,
  media: ChatMediaUpload,
  options: { idempotencyKey: string; onProgress?: (progressPercent: number) => void },
): Promise<{ mediaId: string }> => {
  const bytes = await new File(media.uri).bytes();
  const checksumSha256 = await sha256Hex(bytes);
  const intent = await createUploadIntent(client, tenantId, {
    purpose: 'CHAT_MESSAGE',
    contentType: media.contentType,
    byteSize: media.byteSize,
    durationMs: media.durationMs,
    checksumSha256,
    idempotencyKey: `${options.idempotencyKey}:intent`,
  });
  const mediaId = intent.media?.id;
  if (!mediaId) throw new Error('UPLOAD_INTENT_MISSING_MEDIA_ID');
  const uploadUrl = intent.upload?.url;
  if (uploadUrl && /^https?:/i.test(uploadUrl)) {
    await putMediaFile(
      media.uri,
      uploadUrl,
      media.contentType,
      intent.upload?.requiredHeaders,
      (percent) => options.onProgress?.(percent),
    );
  } else {
    // Dev storage returns a memory:// URL without a reachable upload target.
    options.onProgress?.(100);
  }
  await completeUpload(client, tenantId, mediaId, {
    checksum: checksumSha256,
    idempotencyKey: `${options.idempotencyKey}:complete`,
  });
  return { mediaId };
};

/** Signed, short-lived GET url for rendering or playing a chat attachment. */
export const getMediaDownloadUrl = (client: ApiClient, tenantId: string, mediaId: string) =>
  client
    .tenant(tenantId)
    .request<{ url: string; expiresAt: string }>(
      `/media/${encodeURIComponent(mediaId)}/download-url`,
      { method: 'POST' },
    );

export const formatDuration = (ms: number | null | undefined): string => {
  const totalSeconds = Math.max(0, Math.round((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
