import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const listPenaltySettlements = (client: ApiClient, tenantId: string, yearMonth: string) =>
  client
    .tenant(tenantId)
    .request(`/attendance/penalty-settlements?yearMonth=${encodeURIComponent(yearMonth)}`);
export const submitPaymentProof = (
  client: ApiClient,
  tenantId: string,
  settlementId: string,
  mediaId: string,
  idempotencyKey: string,
) =>
  client
    .tenant(tenantId)
    .request(
      `/attendance/penalty-settlements/${encodeURIComponent(settlementId)}/payment-transitions`,
      {
        method: 'POST',
        body: {
          toStatus: 'SUBMITTED',
          mediaObjectId: mediaId,
          reason: 'Employee submitted payment proof.',
        },
        idempotencyKey,
      },
    );
export const createPaymentProofAction = (
  client: ApiClient,
  tenantId: string,
  settlementId: string,
  permissions: readonly string[],
) => ({
  submit: (mediaId: string) => {
    if (!permissions.includes('attendance.penalty.payment-proof:submit'))
      return Promise.reject(new Error('FORBIDDEN'));
    return submitPaymentProof(
      client,
      tenantId,
      settlementId,
      mediaId,
      `payment-proof-${settlementId}-${mediaId}`,
    );
  },
});
