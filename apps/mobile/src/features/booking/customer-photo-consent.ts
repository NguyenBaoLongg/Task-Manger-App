import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const getEffectivePhotoPolicy = (client: ApiClient, tenantId: string) =>
  client.tenant(tenantId).request('/customer-photo-consent-policies/effective');
export const recordConsent = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: { method: string; policyVersionId: string; idempotencyKey: string },
) =>
  client
    .tenant(tenantId)
    .request<{ id: string }>(`/bookings/${encodeURIComponent(bookingId)}/customer-photo-consents`, {
      method: 'POST',
      body: { method: input.method, policyVersionId: input.policyVersionId },
      idempotencyKey: input.idempotencyKey,
    });
export const createCustomerPhotoUploadIntent = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: {
    consentId: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    idempotencyKey: string;
  },
) =>
  client
    .tenant(tenantId)
    .request<{ mediaId: string }>(
      `/bookings/${encodeURIComponent(bookingId)}/customer-photo-upload-intents`,
      { method: 'POST', body: input, idempotencyKey: input.idempotencyKey },
    );
export const recordArrival = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: {
    consentId: string;
    customerPhotoMediaId?: string;
    expectedStateVersion: number;
    idempotencyKey: string;
  },
) =>
  client.tenant(tenantId).request(`/bookings/${encodeURIComponent(bookingId)}/arrivals`, {
    method: 'POST',
    body: {
      consentId: input.consentId,
      customerPhotoMediaId: input.customerPhotoMediaId,
      expectedStateVersion: input.expectedStateVersion,
    },
    idempotencyKey: input.idempotencyKey,
    expectedStateVersion: input.expectedStateVersion,
  });
