import * as Crypto from 'expo-crypto';
import type { createApiClient } from '@/api/api-client';
import { completeUpload, createUploadIntent } from '@/media/media-upload-transport';
import { submitCheckIn } from './check-in-actions';

type ApiClient = ReturnType<typeof createApiClient>;

export type AttendanceVideoCheckInFlowInput = {
  businessDate: string;
  bytes: Uint8Array;
  policyVersionId?: string;
  attendanceSessionId?: string;
  idempotencyKey: string;
  upload: (input: {
    uploadUrl?: string;
    requiredHeaders?: Record<string, string>;
    bytes: Uint8Array;
    onProgress: (progressPercent: number) => void;
  }) => Promise<void>;
  onProgress?: (progressPercent: number) => void;
};

export const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const runAttendanceVideoCheckInFlow = async (
  client: ApiClient,
  tenantId: string,
  input: AttendanceVideoCheckInFlowInput,
) => {
  const checksumSha256 = await sha256Hex(input.bytes);
  const intent = await createUploadIntent(client, tenantId, {
    purpose: 'ATTENDANCE_CHECK_IN_VIDEO',
    contentType: 'video/mp4',
    byteSize: input.bytes.byteLength,
    checksumSha256,
    idempotencyKey: `${input.idempotencyKey}:intent`,
  });
  const mediaId = intent.media?.id;
  if (!mediaId) throw new Error('UPLOAD_INTENT_MISSING_MEDIA_ID');

  await input.upload({
    uploadUrl: intent.upload?.url,
    requiredHeaders: intent.upload?.requiredHeaders,
    bytes: input.bytes,
    onProgress: (progressPercent) => input.onProgress?.(progressPercent),
  });
  await completeUpload(client, tenantId, mediaId, {
    checksum: checksumSha256,
    idempotencyKey: `${input.idempotencyKey}:complete`,
  });
  await submitCheckIn(client, tenantId, {
    mediaId,
    businessDate: input.businessDate,
    policyVersionId: input.policyVersionId,
    attendanceSessionId: input.attendanceSessionId,
    idempotencyKey: `${input.idempotencyKey}:check-in`,
  });
  return { mediaId, checksumSha256 };
};
