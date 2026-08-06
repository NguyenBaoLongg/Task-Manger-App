import type { createApiClient } from '@/api/api-client';
import * as FileSystem from 'expo-file-system';
import { createCustomerPhotoUploadIntent } from './customer-photo-consent';
import { completeUpload } from '@/media/media-upload-transport';
type ApiClient = ReturnType<typeof createApiClient>;
export const authorizeCustomerPhotoUpload = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: Parameters<typeof createCustomerPhotoUploadIntent>[3],
) => createCustomerPhotoUploadIntent(client, tenantId, bookingId, input);
export const completeCustomerPhotoUpload = (
  client: ApiClient,
  tenantId: string,
  mediaId: string,
  checksumSha256: string,
  idempotencyKey: string,
) => completeUpload(client, tenantId, mediaId, { checksum: checksumSha256, idempotencyKey });
export const createCustomerPhotoUploadFlow = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
) => ({
  authorize: (input: Parameters<typeof createCustomerPhotoUploadIntent>[3]) =>
    authorizeCustomerPhotoUpload(client, tenantId, bookingId, input),
  complete: (mediaId: string, checksumSha256: string, idempotencyKey: string) =>
    completeCustomerPhotoUpload(client, tenantId, mediaId, checksumSha256, idempotencyKey),
});
export const cleanupCustomerPhoto = (uri: string) =>
  FileSystem.deleteAsync(uri, { idempotent: true });
