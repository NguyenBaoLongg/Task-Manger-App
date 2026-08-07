import { createBadgeStore, unreadByKind } from '@/notifications/badge-store';

describe('badge store UI projection', () => {
  it('deduplicates effects and exposes unread counts by kind', () => {
    const store = createBadgeStore();
    store.add({ effectKey: 'approval:1', kind: 'approval' });
    store.add({ effectKey: 'approval:1', kind: 'approval' });
    store.add({ effectKey: 'photo:1', kind: 'photoDebt' });
    expect(store.count()).toBe(2);
    expect(unreadByKind(store.snapshot())).toEqual({ approval: 1, photoDebt: 1 });
    store.markRead('approval:1');
    expect(store.count()).toBe(1);
  });
});
