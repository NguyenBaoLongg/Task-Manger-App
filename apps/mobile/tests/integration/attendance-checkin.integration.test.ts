import { createApiClient } from '@/api/api-client';
import { getAttendanceSchedules, getVideoPolicy } from '@/features/attendance/attendance-queries';
import { acknowledgeVideoPolicy } from '@/features/attendance/video-policy-acknowledgement';
import { submitCheckIn } from '@/features/attendance/check-in-actions';

describe('attendance check-in integration', () => {
  it('reads policy, acknowledges its version and submits a scoped check-in', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'schedule-1' }]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'policy-1', version: 3 }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ack-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'checkin-1' }), { status: 201 }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await getAttendanceSchedules(client, 'tenant-a', '2026-07-26');
    const policy = await getVideoPolicy(client, 'tenant-a');
    await acknowledgeVideoPolicy(client, 'tenant-a', {
      policyVersionId: policy.id,
      deviceId: 'device-test',
      idempotencyKey: 'ack-1',
    });
    await submitCheckIn(client, 'tenant-a', {
      mediaId: 'media-1',
      businessDate: '2026-07-26',
      idempotencyKey: 'checkin-1',
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/attendance/schedules?businessDate=2026-07-26',
      'https://api.example.test/v1/tenants/tenant-a/attendance/video-policies',
      'https://api.example.test/v1/tenants/tenant-a/attendance/video-policy/acknowledgements',
      'https://api.example.test/v1/tenants/tenant-a/attendance/check-ins',
    ]);
  });
});
