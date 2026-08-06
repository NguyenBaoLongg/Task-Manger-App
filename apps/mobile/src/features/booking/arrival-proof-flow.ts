import type { createApiClient } from '@/api/api-client';
import { checksumBytes } from '@/media/media-upload-session';
import { completeUpload } from '@/media/media-upload-transport';
import { getBooking } from './booking-api';
import {
  createCustomerPhotoUploadIntent,
  getEffectivePhotoPolicy,
  recordArrival,
  recordConsent,
} from './customer-photo-consent';
import { listPhotoDebts } from './photo-debt';

type ApiClient = ReturnType<typeof createApiClient>;

type BookingState = {
  id: string;
  branchId?: string;
  stateVersion?: number;
};

type PhotoPolicy = {
  id?: string;
  versionId?: string;
  version?: string | number;
};

type UploadIntentResult = {
  mediaId?: string;
  id?: string;
  uploadUrl?: string;
};

export type BookingArrivedProofFlowInput = {
  bytes: Uint8Array;
  contentType?: string;
  consentMethod?: string;
  branchId?: string;
  idempotencyKey: string;
  upload: (input: { uploadUrl?: string; bytes: Uint8Array; checksum: string }) => Promise<void>;
};

const resolvePolicyVersionId = (policy: PhotoPolicy) => {
  const policyVersionId = policy.id ?? policy.versionId ?? policy.version?.toString();
  if (!policyVersionId) throw new Error('PHOTO_POLICY_VERSION_MISSING');
  return policyVersionId;
};

export const runBookingArrivedProofFlow = async (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: BookingArrivedProofFlowInput,
) => {
  const booking = (await getBooking(client, tenantId, bookingId)) as BookingState;
  const policy = (await getEffectivePhotoPolicy(client, tenantId)) as PhotoPolicy;
  const consent = await recordConsent(client, tenantId, bookingId, {
    method: input.consentMethod ?? 'IN_APP_CONFIRMED',
    policyVersionId: resolvePolicyVersionId(policy),
    idempotencyKey: `${input.idempotencyKey}:consent`,
  });
  const checksum = checksumBytes(input.bytes);
  const intent = (await createCustomerPhotoUploadIntent(client, tenantId, bookingId, {
    consentId: consent.id,
    contentType: input.contentType ?? 'image/jpeg',
    byteSize: input.bytes.byteLength,
    checksumSha256: checksum,
    idempotencyKey: `${input.idempotencyKey}:intent`,
  })) as UploadIntentResult;
  const mediaId = intent.mediaId ?? intent.id;
  if (!mediaId) throw new Error('CUSTOMER_PHOTO_UPLOAD_INTENT_MISSING_MEDIA_ID');

  await input.upload({ uploadUrl: intent.uploadUrl, bytes: input.bytes, checksum });
  await completeUpload(client, tenantId, mediaId, {
    checksum,
    idempotencyKey: `${input.idempotencyKey}:complete`,
  });
  await recordArrival(client, tenantId, bookingId, {
    consentId: consent.id,
    customerPhotoMediaId: mediaId,
    expectedStateVersion: booking.stateVersion ?? 0,
    idempotencyKey: `${input.idempotencyKey}:arrived`,
  });
  const debts = await listPhotoDebts(client, tenantId, input.branchId ?? booking.branchId);

  return { consentId: consent.id, mediaId, checksum, debts };
};
