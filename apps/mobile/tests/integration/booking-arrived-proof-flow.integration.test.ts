import { createApiClient } from '@/api/api-client';
import { runBookingArrivedProofFlow } from '@/features/booking/arrival-proof-flow';

describe('booking arrived proof flow', () => {
  it('loads latest booking, records consent, uploads proof, marks arrived and reconciles photo debt', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'booking-1', stateVersion: 5 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'policy-1', version: 2 }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'consent-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ mediaId: 'media-1' }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'media-1', status: 'READY' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'arrival-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });

    await runBookingArrivedProofFlow(client, 'tenant-a', 'booking-1', {
      branchId: 'branch-a',
      bytes: new Uint8Array([9, 8, 7]),
      upload: async () => undefined,
      idempotencyKey: 'arrival-proof-1',
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1',
      'https://api.example.test/v1/tenants/tenant-a/customer-photo-consent-policies/effective',
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/customer-photo-consents',
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/customer-photo-upload-intents',
      'https://api.example.test/v1/tenants/tenant-a/media/media-1/complete',
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/arrivals',
      'https://api.example.test/v1/tenants/tenant-a/booking-photo-debts?branchId=branch-a',
    ]);
  });
});
