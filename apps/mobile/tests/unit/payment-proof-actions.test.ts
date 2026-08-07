import { createApiClient } from '@/api/api-client';
import { createPaymentProofAction } from '@/features/attendance/penalty-ledger';

describe('payment proof action', () => {
  it('requires the server-authorized permission before submitting proof', async () => {
    const fetchImpl = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(JSON.stringify({ id: 'settlement-1' }), { status: 200 }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await expect(
      createPaymentProofAction(client, 'tenant-a', 'settlement-1', [
        'attendance.penalty.payment-proof:submit',
      ]).submit('media-1'),
    ).resolves.toBeDefined();
    await expect(
      createPaymentProofAction(client, 'tenant-a', 'settlement-1', []).submit('media-1'),
    ).rejects.toThrow('FORBIDDEN');
  });
});
