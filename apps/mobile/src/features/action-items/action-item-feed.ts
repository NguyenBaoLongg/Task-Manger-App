import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;
export type ActionItem = {
  id: string;
  stateVersion: number;
  state: string;
  itemType?: string;
  title?: string;
  deepLink?: string;
};
export type ActionItemPage = { items: ActionItem[]; nextCursor: string | null; openCount: number };
export type EmployeeActionFilters = {
  state?: string;
  itemType?: string;
  businessDate?: string;
  cursor?: string;
};
export type ManagerActionFilters = {
  branchId?: string;
  departmentId?: string;
  membershipId?: string;
  itemType?: string;
  state?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

const query = (filters: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const value = params.toString();
  return value ? `?${value}` : '';
};

export const listEmployeeActionItems = (
  client: ApiClient,
  tenantId: string,
  filters: EmployeeActionFilters = {},
) => client.tenant(tenantId).request<ActionItemPage>(`/action-items${query(filters)}`);

export const listManagedActionItems = (
  client: ApiClient,
  tenantId: string,
  filters: ManagerActionFilters = {},
) => client.tenant(tenantId).request<ActionItemPage>(`/management/action-items${query(filters)}`);
