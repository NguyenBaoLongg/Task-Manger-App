import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;

export const getWorkflowRequest = (client: ApiClient, tenantId: string, requestId: string) =>
  client.tenant(tenantId).request(`/workflows/requests/${encodeURIComponent(requestId)}`);

export const decideWorkflowRequest = (
  client: ApiClient,
  tenantId: string,
  requestId: string,
  input: {
    decision: string;
    reason: string;
    expectedStateVersion?: number;
    idempotencyKey: string;
  },
) =>
  client
    .tenant(tenantId)
    .request(`/workflows/requests/${encodeURIComponent(requestId)}/decisions`, {
      method: 'POST',
      body: {
        decision: input.decision,
        reason: input.reason,
        ...(input.expectedStateVersion === undefined
          ? {}
          : { expectedStateVersion: input.expectedStateVersion }),
      },
      idempotencyKey: input.idempotencyKey,
      expectedStateVersion: input.expectedStateVersion,
    });

export const addWorkflowRequestEvidence = (
  client: ApiClient,
  tenantId: string,
  requestId: string,
  input: {
    mediaId: string;
    reason?: string;
    expectedStateVersion?: number;
    idempotencyKey: string;
  },
) =>
  client.tenant(tenantId).request(`/workflows/requests/${encodeURIComponent(requestId)}/evidence`, {
    method: 'POST',
    body: {
      mediaId: input.mediaId,
      reason: input.reason,
      ...(input.expectedStateVersion === undefined
        ? {}
        : { expectedStateVersion: input.expectedStateVersion }),
    },
    idempotencyKey: input.idempotencyKey,
    expectedStateVersion: input.expectedStateVersion,
  });

export const requestWorkflowChanges = (
  client: ApiClient,
  tenantId: string,
  requestId: string,
  input: {
    reason: string;
    expectedStateVersion?: number;
    idempotencyKey: string;
  },
) =>
  client
    .tenant(tenantId)
    .request(`/workflows/requests/${encodeURIComponent(requestId)}/request-changes`, {
      method: 'POST',
      body: {
        reason: input.reason,
        ...(input.expectedStateVersion === undefined
          ? {}
          : { expectedStateVersion: input.expectedStateVersion }),
      },
      idempotencyKey: input.idempotencyKey,
      expectedStateVersion: input.expectedStateVersion,
    });

export const cancelWorkflowRequest = (
  client: ApiClient,
  tenantId: string,
  requestId: string,
  input: {
    reason: string;
    expectedStateVersion?: number;
    idempotencyKey: string;
  },
) =>
  client.tenant(tenantId).request(`/workflows/requests/${encodeURIComponent(requestId)}/cancel`, {
    method: 'POST',
    body: {
      reason: input.reason,
      ...(input.expectedStateVersion === undefined
        ? {}
        : { expectedStateVersion: input.expectedStateVersion }),
    },
    idempotencyKey: input.idempotencyKey,
    expectedStateVersion: input.expectedStateVersion,
  });
