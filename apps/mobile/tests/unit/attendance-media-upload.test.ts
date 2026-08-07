import { checksumBytes, createMediaUploadSession } from '@/media/media-upload-session';

describe('attendance media upload', () => {
  it('tracks checksum and retryable upload states without losing the media identity', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const session = createMediaUploadSession({
      mediaId: 'media-1',
      bytes,
      expiresAt: Date.now() + 60_000,
    });
    expect(checksumBytes(bytes)).toBe('010203');
    expect(session.state).toBe('PENDING');
    session.start();
    session.fail('network');
    expect(session.state).toBe('FAILED');
    session.retry();
    expect(session.state).toBe('UPLOADING');
    session.complete();
    expect(session.snapshot()).toMatchObject({
      mediaId: 'media-1',
      state: 'READY',
      checksum: '010203',
    });
  });
});
