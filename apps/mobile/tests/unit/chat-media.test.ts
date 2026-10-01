import { uploadChatMedia, formatDuration } from '@/features/chat/chat-media';
import { createApiClient } from '@/api/api-client';

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    bytes() {
      return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
    }
  },
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(async () => new Uint8Array(32).fill(0xab)),
}));

class MockXHR {
  static sent: MockXHR[] = [];
  open: jest.Mock = jest.fn();
  setRequestHeader: jest.Mock = jest.fn();
  status = 200;
  upload: {
    onprogress:
      | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void)
      | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send() {
    MockXHR.sent.push(this);
    this.onload?.();
  }
}

beforeEach(() => {
  MockXHR.sent = [];
  (global as { XMLHttpRequest?: unknown }).XMLHttpRequest = MockXHR;
});

type RecordedCall = { url: string; body?: string; headers: Record<string, string> };

const recordedCalls = (fetchImpl: jest.Mock): RecordedCall[] =>
  (fetchImpl.mock.calls as Array<[RequestInfo | URL, RequestInit?]>).map(([input, init]) => ({
    url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    body: typeof init?.body === 'string' ? init.body : undefined,
    headers: (init?.headers ?? {}) as Record<string, string>,
  }));

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

const routeFetch = (routes: Array<{ match: (url: string) => boolean; respond: () => Response }>) =>
  jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const route = routes.find((item) => item.match(url));
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route.respond();
  });

describe('uploadChatMedia', () => {
  it('intents, PUTs and completes a chat attachment, returning the mediaId', async () => {
    const fetchImpl = routeFetch([
      {
        match: (url) => url.endsWith('/media/upload-intents'),
        respond: () =>
          json(
            {
              media: { id: 'media-1' },
              upload: {
                url: 'https://storage.example.test/put',
                requiredHeaders: { 'x-goog-meta-test': '1' },
              },
            },
            201,
          ),
      },
      {
        match: (url) => url.endsWith('/media/media-1/complete'),
        respond: () => json({ id: 'media-1', status: 'READY' }),
      },
    ]);

    const result = await uploadChatMedia(
      makeClient(fetchImpl),
      'tenant-1',
      { uri: 'file:///storage/clip.mp4', contentType: 'video/mp4', byteSize: 4, durationMs: 3000 },
      { idempotencyKey: 'chat-media-1' },
    );

    expect(result).toEqual({ mediaId: 'media-1' });

    const intent = recordedCalls(fetchImpl).find((call) => call.url.endsWith('/media/upload-intents'));
    expect(intent).toBeTruthy();
    expect(intent?.body ? JSON.parse(intent.body) : null).toMatchObject({
      purpose: 'CHAT_MESSAGE',
      contentType: 'video/mp4',
      byteSize: 4,
      durationMs: 3000,
    });
    expect(intent?.headers['Idempotency-Key']).toBe('chat-media-1:intent');

    expect(MockXHR.sent).toHaveLength(1);
    const xhr = MockXHR.sent[0]!;
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://storage.example.test/put');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('x-goog-meta-test', '1');

    const complete = recordedCalls(fetchImpl).find((call) => call.url.endsWith('/media/media-1/complete'));
    expect(complete).toBeTruthy();
    const completeBody = complete?.body ? (JSON.parse(complete.body) as { checksum?: string }) : null;
    expect(completeBody?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(complete?.headers['Idempotency-Key']).toBe('chat-media-1:complete');
  });

  it('skips the PUT for a memory:// dev upload url', async () => {
    const fetchImpl = routeFetch([
      {
        match: (url) => url.endsWith('/media/upload-intents'),
        respond: () => json({ media: { id: 'media-2' }, upload: { url: 'memory://tenant/media-2' } }, 201),
      },
      {
        match: (url) => url.endsWith('/media/media-2/complete'),
        respond: () => json({ id: 'media-2', status: 'READY' }),
      },
    ]);

    const result = await uploadChatMedia(
      makeClient(fetchImpl),
      'tenant-1',
      { uri: 'file:///storage/voice.m4a', contentType: 'audio/mp4', byteSize: 4 },
      { idempotencyKey: 'chat-media-2' },
    );

    expect(result).toEqual({ mediaId: 'media-2' });
    expect(MockXHR.sent).toHaveLength(0);
  });
});

describe('formatDuration', () => {
  it('formats a voice note length as m:ss', () => {
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(4_000)).toBe('0:04');
  });

  it('falls back to 0:00 when duration is missing', () => {
    expect(formatDuration(null)).toBe('0:00');
    expect(formatDuration(undefined)).toBe('0:00');
  });
});
