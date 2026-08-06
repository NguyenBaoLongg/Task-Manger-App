import { reconcileMessages } from '@/features/chat/chat-realtime';

describe('chat realtime', () => {
  it('keeps server ordering and deduplicates optimistic messages by client id', () => {
    expect(
      reconcileMessages(
        [{ id: 'm-1', clientMessageId: 'c-1', createdAt: 2 }],
        [
          { id: 'm-2', clientMessageId: 'c-1', createdAt: 3 },
          { id: 'm-3', clientMessageId: 'c-2', createdAt: 1 },
        ],
      ),
    ).toEqual([
      { id: 'm-3', clientMessageId: 'c-2', createdAt: 1 },
      { id: 'm-2', clientMessageId: 'c-1', createdAt: 3 },
    ]);
  });
});
