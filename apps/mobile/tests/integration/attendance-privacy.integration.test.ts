import { createApiClient } from '@/api/api-client';
import { createTenantContext } from '@/tenant/tenant-context';
import { redactTelemetry } from '@/observability/safe-telemetry';

describe('attendance privacy and scope', () => {
  it('does not let foreign branch media or payment proof cross the tenant boundary', () => {
    const context = createTenantContext({
      tenantId: 'tenant-a',
      membershipId: 'm-a',
      branchId: 'branch-a',
      permissions: ['attendance.read'],
      version: 1,
    });
    expect(() => context.assertScope({ tenantId: 'tenant-b', branchId: 'branch-a' })).toThrow(
      'TENANT_SCOPE_MISMATCH',
    );
    expect(() => context.assertScope({ tenantId: 'tenant-a', branchId: 'branch-b' })).toThrow(
      'BRANCH_SCOPE_MISMATCH',
    );
    expect(
      JSON.stringify(
        redactTelemetry({ signedUrl: 'secret', objectKey: 'private/video.mp4', proof: 'raw' }),
      ),
    ).not.toContain('secret');
  });

  it('does not attach an access token to a public upload-intent request', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ id: 'intent-1' }), { status: 201 }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await client
      .tenant('tenant-a')
      .request('/media/upload-intents', { method: 'POST', body: { purpose: 'ATTENDANCE_VIDEO' } });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer access' }),
    );
  });
});
