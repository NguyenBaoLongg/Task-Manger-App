import { createApiClient } from '@/api/api-client';
import {
  recordConsent,
  createCustomerPhotoUploadIntent,
  recordArrival,
} from '@/features/booking/customer-photo-consent';

describe('booking arrival proof integration', () => {
  it('requires consent before proof intent and sends consent/media to ARRIVED', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'consent-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ mediaId: 'media-1' }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ booking: { id: 'booking-1' }, photoDebt: null }), {
          status: 200,
        }),
      );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    const consent = await recordConsent(client, 'tenant-a', 'booking-1', {
      method: 'WRITTEN',
      policyVersionId: 'policy-1',
      idempotencyKey: 'consent-1',
    });
    const intent = await createCustomerPhotoUploadIntent(client, 'tenant-a', 'booking-1', {
      consentId: consent.id,
      contentType: 'image/jpeg',
      byteSize: 10,
      checksumSha256: 'a'.repeat(64),
      idempotencyKey: 'media-1',
    });
    await recordArrival(client, 'tenant-a', 'booking-1', {
      consentId: consent.id,
      customerPhotoMediaId: intent.mediaId,
      expectedStateVersion: 2,
      idempotencyKey: 'arrival-1',
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/customer-photo-consents',
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/customer-photo-upload-intents',
      'https://api.example.test/v1/tenants/tenant-a/bookings/booking-1/arrivals',
    ]);
  });
});
