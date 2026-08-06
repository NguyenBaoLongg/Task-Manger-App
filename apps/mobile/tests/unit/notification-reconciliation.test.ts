import { createBadgeStore } from '@/notifications/badge-store';
import { parseNotificationPayload } from '@/notifications/notification-payload';

describe('notification reconciliation', () => {
  it('deduplicates effect keys and rejects unsafe payloads', () => {
    const store = createBadgeStore();
    store.add({ effectKey: 'item:1', kind: 'approval' });
    store.add({ effectKey: 'item:1', kind: 'approval' });
    expect(store.count()).toBe(1);
    expect(
      parseNotificationPayload({
        tenantId: 'tenant-a',
        eventId: 'e-1',
        kind: 'approval',
        deepLink: '/approvals/1',
      }),
    ).toMatchObject({ eventId: 'e-1' });
    expect(
      parseNotificationPayload({ tenantId: 'tenant-a', eventId: 'e-1', token: 'secret' }),
    ).toBeUndefined();
  });
});
