import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const acknowledgeVideoPolicy = (
  client: ApiClient,
  tenantId: string,
  input: { policyVersionId: string; deviceId: string; idempotencyKey: string },
) =>
  client.tenant(tenantId).request('/attendance/video-policy/acknowledgements', {
    method: 'POST',
    body: {
      policyVersionId: input.policyVersionId,
      action: 'ACKNOWLEDGED',
      deviceId: input.deviceId,
    },
    idempotencyKey: input.idempotencyKey,
  });
