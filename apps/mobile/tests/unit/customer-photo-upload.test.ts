import { createApiClient } from '@/api/api-client';
import { createCustomerPhotoUploadFlow } from '@/features/booking/customer-photo-upload';

describe('customer proof photo upload', () => {
  it('binds the upload to consent and completes the media intent idempotently', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(new Response(JSON.stringify({ mediaId: 'media-1' }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ mediaId: 'media-1', state: 'READY' }), { status: 200 }),
      );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    const flow = createCustomerPhotoUploadFlow(client, 'tenant-a', 'booking-1');
    const intent = await flow.authorize({
      consentId: 'consent-1',
      contentType: 'image/jpeg',
      byteSize: 10,
      checksumSha256: 'a'.repeat(64),
      idempotencyKey: 'intent-1',
    });
    await flow.complete(intent.mediaId, 'a'.repeat(64), 'complete-1');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('/media/media-1/complete');
  });
});
