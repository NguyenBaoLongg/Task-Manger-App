import { createApiClient } from '@/api/api-client';
import {
  listBookings,
  createScheduledBooking,
  createWalkInBooking,
} from '@/features/booking/booking-api';

describe('booking calendar integration', () => {
  it('keeps branch filters and cursor paging on customer/booking operations', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await listBookings(client, 'tenant-a', {
      branchId: 'branch-a',
      businessDate: '2026-07-26',
      cursor: 'cursor-1',
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/v1/tenants/tenant-a/bookings?branchId=branch-a&businessDate=2026-07-26&cursor=cursor-1',
    );
  });

  it('uses separate scheduled and walk-in endpoints with idempotency', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockImplementation(
      async () => new Response(JSON.stringify({ id: 'booking-1' }), { status: 201 }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await createScheduledBooking(client, 'tenant-a', {
      branchId: 'branch-a',
      scheduledStartAt: '2026-07-26T10:00:00Z',
      formData: {},
      idempotencyKey: 'booking-1',
    });
    await createWalkInBooking(client, 'tenant-a', {
      branchId: 'branch-a',
      formData: {},
      idempotencyKey: 'booking-2',
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/bookings',
      'https://api.example.test/v1/tenants/tenant-a/bookings:walk-in',
    ]);
  });
});
