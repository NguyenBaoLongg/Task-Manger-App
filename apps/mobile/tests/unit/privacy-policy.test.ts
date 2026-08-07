import { createSafeLogger } from '@/observability/safe-logger';
import { redactTelemetry } from '@/observability/safe-telemetry';
import { createCachePolicy } from '@/storage/cache-policy';

describe('mobile privacy boundaries', () => {
  it('redacts credentials, PII, signed URLs and media keys', () => {
    const value = redactTelemetry({
      accessToken: 'secret-token',
      email: 'staff@example.test',
      signedUrl: 'https://storage.test/signed',
      objectKey: 'tenant-a/private/video.mp4',
      mediaPayload: { bytes: 'raw' },
      safeId: 'booking-1',
    });
    expect(value).toEqual(expect.objectContaining({ safeId: 'booking-1' }));
    expect(JSON.stringify(value)).not.toContain('secret-token');
    expect(JSON.stringify(value)).not.toContain('staff@example.test');
    expect(JSON.stringify(value)).not.toContain('https://storage.test/signed');
    expect(JSON.stringify(value)).not.toContain('video.mp4');
  });

  it('logs only redacted structured values and excludes sensitive cache families', () => {
    const sink = jest.fn();
    const logger = createSafeLogger(sink);
    logger.info('booking.loaded', {
      bookingId: 'b-1',
      customerName: 'Secret',
      signedUrl: 'private',
    });
    expect(sink).toHaveBeenCalledWith(
      'info',
      'booking.loaded',
      expect.objectContaining({ bookingId: 'b-1' }),
    );
    expect(JSON.stringify(sink.mock.calls)).not.toContain('Secret');
    const policy = createCachePolicy();
    expect(policy.isSensitive(['tenant', 't-1', 'attendance', 'media'])).toBe(true);
    expect(policy.isSensitive(['tenant', 't-1', 'dashboard'])).toBe(false);
  });
});
