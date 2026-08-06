import { reconcileActionItems } from '@/features/action-items/action-item-reconciliation';

describe('action-item reconciliation', () => {
  it('deduplicates repeated events and keeps the newest server version', () => {
    const result = reconcileActionItems(
      [
        { id: 'item-1', stateVersion: 1, state: 'OPEN' },
        { id: 'item-2', stateVersion: 1, state: 'OPEN' },
      ],
      [
        { id: 'item-1', stateVersion: 2, state: 'DONE' },
        { id: 'item-1', stateVersion: 2, state: 'DONE' },
      ],
    );
    expect(result).toEqual([
      { id: 'item-1', stateVersion: 2, state: 'DONE' },
      { id: 'item-2', stateVersion: 1, state: 'OPEN' },
    ]);
  });
});
