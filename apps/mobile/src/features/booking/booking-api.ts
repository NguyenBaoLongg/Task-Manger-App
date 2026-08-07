import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
const query = (filters: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const value = params.toString();
  return value ? `?${value}` : '';
};
export const listCustomers = (
  client: ApiClient,
  tenantId: string,
  filters: { branchId?: string; cursor?: string } = {},
) => client.tenant(tenantId).request(`/customers${query(filters)}`);
export const listBookings = (
  client: ApiClient,
  tenantId: string,
  filters: { branchId?: string; businessDate?: string; cursor?: string; status?: string } = {},
) => client.tenant(tenantId).request(`/bookings${query(filters)}`);
export const getBooking = (client: ApiClient, tenantId: string, bookingId: string) =>
  client.tenant(tenantId).request(`/bookings/${encodeURIComponent(bookingId)}`);
export const createScheduledBooking = (
  client: ApiClient,
  tenantId: string,
  input: {
    branchId: string;
    scheduledStartAt: string;
    formData: Record<string, unknown>;
    idempotencyKey: string;
    customerId?: string;
    serviceOfferingId?: string;
    assignedMembershipId?: string;
    formTemplateId?: string;
    formVersionId?: string;
  },
) =>
  client
    .tenant(tenantId)
    .request('/bookings', { method: 'POST', body: input, idempotencyKey: input.idempotencyKey });
export const createWalkInBooking = (
  client: ApiClient,
  tenantId: string,
  input: {
    branchId: string;
    formData: Record<string, unknown>;
    idempotencyKey: string;
    customerId?: string;
    serviceOfferingId?: string;
    assignedMembershipId?: string;
    formTemplateId?: string;
    formVersionId?: string;
  },
) =>
  client.tenant(tenantId).request('/bookings:walk-in', {
    method: 'POST',
    body: input,
    idempotencyKey: input.idempotencyKey,
  });
