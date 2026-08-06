import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export type WorkflowRequestInput = {
  requestType: string;
  duration: string;
  startDate: string;
  endDate: string;
  idempotencyKey: string;
  reason: string;
  payload?: Record<string, unknown>;
};
export const workflowRequestFieldSchema = [
  { name: 'duration', label: 'Thời lượng', type: 'select', required: true },
  { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
  { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
  { name: 'reason', label: 'Lý do', type: 'text', required: true },
] as const;
export const submitWorkflowRequest = (
  client: ApiClient,
  tenantId: string,
  input: WorkflowRequestInput,
) =>
  client.tenant(tenantId).request('/workflows/requests', {
    method: 'POST',
    body: {
      requestType: input.requestType,
      payload: input.payload ?? {
        duration: input.duration,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      reason: input.reason,
    },
    idempotencyKey: input.idempotencyKey,
  });
