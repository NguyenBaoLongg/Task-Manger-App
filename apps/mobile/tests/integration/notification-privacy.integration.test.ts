import { parseNotificationPayload } from '@/notifications/notification-payload';

describe('notification privacy', () => {
  it('accepts only safe IDs/routes and rejects tokens, PII and signed URLs', () => {
    expect(
      parseNotificationPayload({
        tenantId: 'tenant-a',
        eventId: 'e-1',
        kind: 'booking',
        sourceId: 'b-1',
        deepLink: '/booking/b-1',
      }),
    ).toBeTruthy();
    expect(
      parseNotificationPayload({
        tenantId: 'tenant-a',
        eventId: 'e-1',
        kind: 'booking',
        deepLink: 'https://evil.test',
        signedUrl: 'private',
      }),
    ).toBeUndefined();
  });
});
