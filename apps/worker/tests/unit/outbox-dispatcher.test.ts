import { describe, expect, it, vi } from 'vitest';
import { OutboxDispatcher } from '../../src/outbox/outbox-dispatcher.js';

const event = {
  id: 'event-1',
  tenantId: '10000000-0000-4000-8000-000000000001',
  aggregateId: '20000000-0000-4000-8000-000000000001',
  eventType: 'action-item.changed',
  payloadRedacted: { ownerMembershipId: '30000000-0000-4000-8000-000000000001', stateVersion: 2 },
  attempt: 1,
};

describe('bounded outbox dispatcher', () => {
  it('claims, fans out and marks one event sent', async () => {
    const markOutboxSent = vi.fn();
    const publishActionItemChanged = vi.fn();
    const dispatcher = new OutboxDispatcher(
      { claimOutbox: vi.fn().mockResolvedValue([event]), markOutboxSent } as never,
      { publishActionItemChanged, publishProgressChanged: vi.fn() },
      { notify: vi.fn() },
    );
    await expect(dispatcher.dispatch('worker-1')).resolves.toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(publishActionItemChanged).toHaveBeenCalledOnce();
    expect(markOutboxSent).toHaveBeenCalledOnce();
  });

  it('retries with a safe error and dead-letters only at the attempt bound', async () => {
    const markOutboxFailed = vi.fn();
    const dispatcher = new OutboxDispatcher(
      {
        claimOutbox: vi.fn().mockResolvedValue([{ ...event, attempt: 10 }]),
        markOutboxFailed,
      } as never,
      {
        publishActionItemChanged: vi.fn().mockRejectedValue(new Error('secret transport detail')),
        publishProgressChanged: vi.fn(),
      },
      { notify: vi.fn() },
      10,
    );
    await expect(dispatcher.dispatch('worker-1')).resolves.toEqual({
      claimed: 1,
      sent: 0,
      failed: 1,
    });
    expect(markOutboxFailed).toHaveBeenCalledWith(
      expect.objectContaining({ deadLetter: true, safeError: 'Error' }),
    );
    expect(JSON.stringify(markOutboxFailed.mock.calls)).not.toContain('secret transport detail');
  });
});
