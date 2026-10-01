import { createApiClient } from '@/api/api-client';
import { runAttendanceVideoCheckInFlow } from '@/features/attendance/video-check-in-flow';

// SHA-256 of bytes [1, 2, 3, 4]
const SEED_SHA256 = '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(async () =>
    Uint8Array.from(SEED_SHA256.match(/.{2}/g)!.map((pair) => parseInt(pair, 16))).buffer,
  ),
}));

describe('attendance video check-in flow', () => {
  it('creates upload intent, reports progress, completes media and submits one check-in', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            media: { id: 'media-1' },
            upload: { url: 'https://upload.test/1', requiredHeaders: { 'x-amz-meta-sha256': SEED_SHA256 } },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'media-1', status: 'READY' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'checkin-1' }), { status: 201 }));
    const progress: number[] = [];
    const uploaded: Array<{
      uploadUrl?: string;
      requiredHeaders?: Record<string, string>;
      bytes: Uint8Array;
      onProgress: (progressPercent: number) => void;
    }> = [];
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });

    const result = await runAttendanceVideoCheckInFlow(client, 'tenant-a', {
      businessDate: '2026-07-26',
      bytes: new Uint8Array([1, 2, 3, 4]),
      policyVersionId: 'policy-1',
      attendanceSessionId: 'session-1',
      upload: async (uploadInput) => {
        uploaded.push(uploadInput);
        uploadInput.onProgress(25);
        uploadInput.onProgress(100);
      },
      onProgress: (value) => progress.push(value),
      idempotencyKey: 'checkin-intent-1',
    });

    expect(result).toEqual({ mediaId: 'media-1', checksumSha256: SEED_SHA256 });
    expect(progress).toEqual([25, 100]);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.uploadUrl).toBe('https://upload.test/1');
    expect(uploaded[0]?.requiredHeaders).toEqual({ 'x-amz-meta-sha256': SEED_SHA256 });
    expect(uploaded[0]?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(typeof uploaded[0]?.onProgress).toBe('function');
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/media/upload-intents',
      'https://api.example.test/v1/tenants/tenant-a/media/media-1/complete',
      'https://api.example.test/v1/tenants/tenant-a/attendance/check-ins',
    ]);
    const intentBody = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string) as {
      purpose: string;
      contentType: string;
      byteSize: number;
      checksumSha256: string;
    };
    expect(intentBody).toEqual({
      purpose: 'ATTENDANCE_CHECK_IN_VIDEO',
      contentType: 'video/mp4',
      byteSize: 4,
      checksumSha256: SEED_SHA256,
    });
    const checkInBody = JSON.parse(fetchImpl.mock.calls[2]?.[1]?.body as string) as {
      mediaObjectId?: string;
      businessDate?: string;
      policyVersionId?: string;
      attendanceSessionId?: string;
    };
    expect(checkInBody).toMatchObject({
      mediaObjectId: 'media-1',
      businessDate: '2026-07-26',
      policyVersionId: 'policy-1',
      attendanceSessionId: 'session-1',
    });
  });
});
