import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export type FormVersion = {
  id: string;
  templateId: string;
  schema: Record<string, unknown>;
  versionNumber: number;
};
export const listFormTemplates = (client: ApiClient, tenantId: string) =>
  client.tenant(tenantId).request('/form-templates');
export const loadFormVersion = (
  client: ApiClient,
  tenantId: string,
  templateId: string,
  versionId: string,
) =>
  client
    .tenant(tenantId)
    .request<FormVersion>(
      `/form-templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}`,
    );
