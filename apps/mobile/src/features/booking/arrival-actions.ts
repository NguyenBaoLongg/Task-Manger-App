import type { createApiClient } from '@/api/api-client';
import { recordArrival } from './customer-photo-consent';
type ApiClient = ReturnType<typeof createApiClient>;
export const markArrived = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  input: Parameters<typeof recordArrival>[3],
) => recordArrival(client, tenantId, bookingId, input);
export const completeTour = (
  client: ApiClient,
  tenantId: string,
  bookingId: string,
  expectedStateVersion: number,
  idempotencyKey: string,
) =>
  client.tenant(tenantId).request(`/bookings/${encodeURIComponent(bookingId)}/tour-completions`, {
    method: 'POST',
    body: { expectedStateVersion },
    expectedStateVersion,
    idempotencyKey,
  });
