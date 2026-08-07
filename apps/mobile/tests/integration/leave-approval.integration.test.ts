import { createApiClient } from '@/api/api-client';
import { submitWorkflowRequest } from '@/features/approvals/request-adapters';
import { decideWorkflowRequest } from '@/features/approvals/approval-actions';

describe('leave and approval integration', () => {
  it('uses one workflows request route for full day, half day and date range', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'request-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'decision-1' }), { status: 201 }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await submitWorkflowRequest(client, 'tenant-a', {
      requestType: 'SUDDEN_LEAVE',
      duration: 'MORNING_HALF_DAY',
      startDate: '2026-07-26',
      endDate: '2026-07-26',
      reason: 'Gia đình cần xử lý việc đột xuất.',
      idempotencyKey: 'request-1',
    });
    await decideWorkflowRequest(client, 'tenant-a', 'request-1', {
      decision: 'APPROVE',
      reason: 'Đã kiểm tra và phê duyệt.',
      expectedStateVersion: 2,
      idempotencyKey: 'decision-1',
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests',
    );
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      'https://api.example.test/v1/tenants/tenant-a/workflows/requests/request-1/decisions',
    );
  });
});
