import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const listPhotoDebts = (client: ApiClient, tenantId: string, branchId?: string) =>
  client
    .tenant(tenantId)
    .request(`/booking-photo-debts${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`);
