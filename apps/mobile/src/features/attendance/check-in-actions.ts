import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const submitCheckIn = (
  client: ApiClient,
  tenantId: string,
  input: {
    mediaId: string;
    businessDate: string;
    idempotencyKey: string;
    policyVersionId?: string;
    attendanceSessionId?: string;
  },
) =>
  client.tenant(tenantId).request('/attendance/check-ins', {
    method: 'POST',
    body: {
      mediaObjectId: input.mediaId,
      businessDate: input.businessDate,
      ...(input.policyVersionId ? { policyVersionId: input.policyVersionId } : {}),
      ...(input.attendanceSessionId ? { attendanceSessionId: input.attendanceSessionId } : {}),
    },
    idempotencyKey: input.idempotencyKey,
  });
