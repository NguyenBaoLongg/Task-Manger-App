import type { createApiClient } from '@/api/api-client';
import { checksumBytes } from '@/media/media-upload-session';
import { completeUpload, createUploadIntent } from '@/media/media-upload-transport';
import { submitCheckIn } from './check-in-actions';

type ApiClient = ReturnType<typeof createApiClient>;

type UploadIntentResult = { mediaId?: string; id?: string; uploadUrl?: string };

export type AttendanceVideoCheckInFlowInput = {
  businessDate: string;
  bytes: Uint8Array;
  policyVersionId?: string;
  attendanceSessionId?: string;
  idempotencyKey: string;
  upload: (input: {
    uploadUrl?: string;
    bytes: Uint8Array;
    checksum: string;
    onProgress: (progressPercent: number) => void;
  }) => Promise<void>;
  onProgress?: (progressPercent: number) => void;
};

export const runAttendanceVideoCheckInFlow = async (
  client: ApiClient,
  tenantId: string,
  input: AttendanceVideoCheckInFlowInput,
) => {
  const checksum = checksumBytes(input.bytes);
  const intent = (await createUploadIntent(client, tenantId, {
    purpose: 'ATTENDANCE_CHECK_IN_VIDEO',
    checksum,
    sizeBytes: input.bytes.byteLength,
    idempotencyKey: `${input.idempotencyKey}:intent`,
  })) as UploadIntentResult;
  const mediaId = intent.mediaId ?? intent.id;
  if (!mediaId) throw new Error('UPLOAD_INTENT_MISSING_MEDIA_ID');

  await input.upload({
    uploadUrl: intent.uploadUrl,
    bytes: input.bytes,
    checksum,
    onProgress: (progressPercent) => input.onProgress?.(progressPercent),
  });
  await completeUpload(client, tenantId, mediaId, {
    checksum,
    idempotencyKey: `${input.idempotencyKey}:complete`,
  });
  await submitCheckIn(client, tenantId, {
    mediaId,
    businessDate: input.businessDate,
    policyVersionId: input.policyVersionId,
    attendanceSessionId: input.attendanceSessionId,
    idempotencyKey: `${input.idempotencyKey}:check-in`,
  });
  return { mediaId, checksum };
};
