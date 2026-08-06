import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const listCancellationReasons = (client: ApiClient, tenantId: string) =>
  client.tenant(tenantId).request('/booking-cancellation-reasons');
export const recordOutcome = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: {
    outcome: string;
    reasonVersionId: string;
    expectedStateVersion: number;
    idempotencyKey: string;
  },
) =>
  client.tenant(tenantId).request(`/bookings/${encodeURIComponent(bookingId)}/outcomes`, {
    method: 'POST',
    body: input,
    idempotencyKey: input.idempotencyKey,
    expectedStateVersion: input.expectedStateVersion,
  });
export const rescheduleBooking = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: {
    scheduledStartAt: string;
    assignedMembershipId: string;
    reasonVersionId: string;
    expectedStateVersion: number;
    idempotencyKey: string;
  },
) =>
  client.tenant(tenantId).request(`/bookings/${encodeURIComponent(bookingId)}/reschedules`, {
    method: 'POST',
    body: input,
    idempotencyKey: input.idempotencyKey,
    expectedStateVersion: input.expectedStateVersion,
  });
