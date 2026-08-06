import { createApiClient } from '@/api/api-client';
import {
  addWorkflowRequestEvidence,
  cancelWorkflowRequest,
  decideWorkflowRequest,
  getWorkflowRequest,
  requestWorkflowChanges,
} from '@/features/approvals/approval-actions';

describe('approval detail flow', () => {
  it('loads state, sends evidence, request-changes, decision and cancel with versions', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'request-1', stateVersion: 4 }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'evidence-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'changes-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'decision-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });

    await getWorkflowRequest(client, 'tenant-a', 'request-1');
    await addWorkflowRequestEvidence(client, 'tenant-a', 'request-1', {
      mediaId: 'media-1',
      reason: 'Bổ sung chứng từ',
      expectedStateVersion: 4,
      idempotencyKey: 'evidence-1',
    });
    await requestWorkflowChanges(client, 'tenant-a', 'request-1', {
      reason: 'Cần bổ sung',
      expectedStateVersion: 4,
      idempotencyKey: 'changes-1',
    });
    await decideWorkflowRequest(client, 'tenant-a', 'request-1', {
      decision: 'APPROVE',
      reason: 'Đủ điều kiện',
      expectedStateVersion: 4,
      idempotencyKey: 'decision-1',
    });
    await cancelWorkflowRequest(client, 'tenant-a', 'request-1', {
      reason: 'Người tạo hủy',
      expectedStateVersion: 4,
      idempotencyKey: 'cancel-1',
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests/request-1',
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests/request-1/evidence',
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests/request-1/request-changes',
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests/request-1/decisions',
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests/request-1/cancel',
    ]);
  });
});
