import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;
export type WorkspaceMembership = {
  tenantId: string;
  membershipId: string;
  name: string;
  status?: string;
};
export type Branch = { id: string; name: string; status?: string };

type BackendWorkspaceSummary = {
  tenant: { id: string; name: string; status?: string };
  membership: { id: string; tenantId: string; status?: string };
};

type WorkspaceResponse = WorkspaceMembership[] | BackendWorkspaceSummary[];

export const selectWorkspace = async (client: ApiClient): Promise<WorkspaceMembership[]> => {
  const response = await client.request<WorkspaceResponse>('/v1/me/tenants');
  return response.map((item) =>
    'tenant' in item
      ? {
          tenantId: item.tenant.id,
          membershipId: item.membership.id,
          name: item.tenant.name,
          status: item.membership.status,
        }
      : item,
  );
};
export const selectBranch = (client: ApiClient, tenantId: string) =>
  client.tenant(tenantId).request<Branch[]>('/branches');
