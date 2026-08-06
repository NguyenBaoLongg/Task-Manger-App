import { createApiClient } from '@/api/api-client';
import { recordOutcome, rescheduleBooking } from '@/features/booking/outcome-actions';

describe('booking outcome integration', () => {
  it('sends reason version and optimistic state to outcome/reschedule operations', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockImplementation(
      async () => new Response(JSON.stringify({ id: 'booking-2' }), { status: 200 }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await recordOutcome(client, 'tenant-a', 'booking-1', {
      outcome: 'CANCELLED',
      reasonVersionId: 'reason-1',
      expectedStateVersion: 3,
      idempotencyKey: 'outcome-1',
    });
    await rescheduleBooking(client, 'tenant-a', 'booking-1', {
      scheduledStartAt: '2026-07-26T12:00:00Z',
      assignedMembershipId: 'm-1',
      reasonVersionId: 'reason-1',
      expectedStateVersion: 3,
      idempotencyKey: 'reschedule-1',
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/outcomes',
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/reschedules',
    ]);
  });
});
