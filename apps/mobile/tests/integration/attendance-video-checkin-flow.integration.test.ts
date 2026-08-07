import { createApiClient } from '@/api/api-client';
import { runAttendanceVideoCheckInFlow } from '@/features/attendance/video-check-in-flow';

describe('attendance video check-in flow', () => {
  it('creates upload intent, reports progress, completes media and submits one check-in', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ mediaId: 'media-1', uploadUrl: 'https://upload.test/1' }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'media-1', status: 'READY' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'checkin-1' }), { status: 201 }));
    const progress: number[] = [];
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
      upload: async ({ onProgress }) => {
        onProgress(25);
        onProgress(100);
      },
      onProgress: (value) => progress.push(value),
      idempotencyKey: 'checkin-intent-1',
    });

    expect(result.mediaId).toBe('media-1');
    expect(progress).toEqual([25, 100]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/tenants/tenant-a/media/upload-intents',
      'https://api.example.test/v1/tenants/tenant-a/media/media-1/complete',
      'https://api.example.test/v1/tenants/tenant-a/attendance/check-ins',
    ]);
    const checkInBody = fetchImpl.mock.calls[2]?.[1]?.body as string;
    expect(JSON.parse(checkInBody)).toMatchObject({
      mediaObjectId: 'media-1',
      businessDate: '2026-07-26',
      policyVersionId: 'policy-1',
      attendanceSessionId: 'session-1',
    });
  });
});
