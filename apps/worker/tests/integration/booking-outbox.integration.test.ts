import { describe, expect, it, vi } from 'vitest';
import { OutboxDispatcher } from '../../src/outbox/outbox-dispatcher.js';

describe('booking outbox retry and tenant isolation', () => {
  it('retries a failed delivery and never uses a payload tenant to cross the event tenant boundary', async () => {
    const claimOutbox = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: '10000000-0000-4000-8000-000000000001',
          tenantId: 'tenant-a',
          eventType: 'workflow.step.activated',
          aggregateId: '20000000-0000-4000-8000-000000000001',
          correlationId: 'outbox-a',
          attempt: 1,
          payloadRedacted: {
            approverMembershipIds: ['member-a'],
            requestedByMembershipId: 'member-a',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '10000000-0000-4000-8000-000000000001',
          tenantId: 'tenant-a',
          eventType: 'workflow.step.activated',
          aggregateId: '20000000-0000-4000-8000-000000000001',
          correlationId: 'outbox-a',
          attempt: 2,
          payloadRedacted: {
            approverMembershipIds: ['member-a'],
            requestedByMembershipId: 'member-a',
          },
        },
      ]);
    const notify = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue(undefined);
    const repository = {
      claimOutbox,
      markOutboxSent: vi.fn(),
      markOutboxFailed: vi.fn(),
    };
    const dispatcher = new OutboxDispatcher(
      repository as never,
      { publishActionItemChanged: vi.fn(), publishProgressChanged: vi.fn() },
      { notify },
      3,
    );
    await expect(dispatcher.dispatch('worker-a')).resolves.toMatchObject({ failed: 1, sent: 0 });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', membershipId: 'member-a' }),
    );
    expect(repository.markOutboxFailed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' }),
    );
    await expect(dispatcher.dispatch('worker-a')).resolves.toMatchObject({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
  });
});
