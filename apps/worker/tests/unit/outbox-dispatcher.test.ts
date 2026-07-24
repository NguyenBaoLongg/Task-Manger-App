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

  it('fans out check-in reminders to every mentioned membership with per-recipient idempotency', async () => {
    const notify = vi.fn();
    const markOutboxSent = vi.fn();
    const dispatcher = new OutboxDispatcher(
      {
        claimOutbox: vi.fn().mockResolvedValue([
          {
            ...event,
            eventType: 'attendance.checkin-reminder.due',
            payloadRedacted: {
              mentionMembershipIds: [
                '30000000-0000-4000-8000-000000000001',
                '30000000-0000-4000-8000-000000000002',
              ],
              messageBody: 'Nhắc check-in ca 08:30: @An Nguyen, @Binh Tran chưa check-in video.',
              businessDate: '2026-07-24',
              shiftStartLocalTime: '08:30',
            },
          },
        ]),
        markOutboxSent,
      } as never,
      { publishActionItemChanged: vi.fn(), publishProgressChanged: vi.fn() },
      { notify },
    );

    await expect(dispatcher.dispatch('worker-1')).resolves.toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        membershipId: '30000000-0000-4000-8000-000000000001',
        dedupeKey: 'event-1:30000000-0000-4000-8000-000000000001',
        title: 'Nhắc check-in',
      }),
    );
    expect(notify).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        membershipId: '30000000-0000-4000-8000-000000000002',
        dedupeKey: 'event-1:30000000-0000-4000-8000-000000000002',
        body: 'Nhắc check-in ca 08:30: @An Nguyen, @Binh Tran chưa check-in video.',
      }),
    );
    expect(markOutboxSent).toHaveBeenCalledOnce();
  });

  it('fans out final noon check-in warnings with the final reminder title', async () => {
    const notify = vi.fn();
    const dispatcher = new OutboxDispatcher(
      {
        claimOutbox: vi.fn().mockResolvedValue([
          {
            ...event,
            eventType: 'attendance.checkin-reminder.due',
            payloadRedacted: {
              reminderKind: 'NOON_FINAL',
              mentionMembershipIds: ['30000000-0000-4000-8000-000000000001'],
              messageBody:
                'Nhắc check-in lần cuối trước 12:00 ca 08:30: @An Nguyen chưa check-in video. Sau 12:00 sẽ tính lỗi không check-in và phạt theo policy nếu không có OFF/nghỉ hợp lệ.',
              businessDate: '2026-07-24',
              shiftStartLocalTime: '08:30',
              cutoffLocalTime: '12:00',
            },
          },
        ]),
        markOutboxSent: vi.fn(),
      } as never,
      { publishActionItemChanged: vi.fn(), publishProgressChanged: vi.fn() },
      { notify },
    );

    await expect(dispatcher.dispatch('worker-1')).resolves.toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: '30000000-0000-4000-8000-000000000001',
        title: 'Nhắc check-in lần cuối',
        data: {
          sourceType: 'ATTENDANCE_CHECKIN_REMINDER',
          reminderKind: 'NOON_FINAL',
          businessDate: '2026-07-24',
          shiftStartLocalTime: '08:30',
          cutoffLocalTime: '12:00',
        },
      }),
    );
  });

  it('fans out activated workflow steps to resolved approvers with stable recipient dedupe', async () => {
    const notify = vi.fn();
    const dispatcher = new OutboxDispatcher(
      {
        claimOutbox: vi.fn().mockResolvedValue([
          {
            ...event,
            eventType: 'workflow.step.activated',
            payloadRedacted: {
              requestId: 'request-1',
              requestType: 'LEAVE_SCHEDULE',
              approverMembershipIds: ['manager-1', 'manager-2'],
            },
          },
        ]),
        markOutboxSent: vi.fn(),
      } as never,
      { publishActionItemChanged: vi.fn(), publishProgressChanged: vi.fn() },
      { notify },
    );

    await dispatcher.dispatch('worker-1');

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        membershipId: 'manager-1',
        dedupeKey: 'event-1:manager-1',
        type: 'workflow.step.activated',
      }),
    );
  });

  it('notifies every scoped manager for an over-threshold absence summary', async () => {
    const notify = vi.fn();
    const dispatcher = new OutboxDispatcher(
      {
        claimOutbox: vi.fn().mockResolvedValue([
          {
            ...event,
            eventType: 'absence.summary.threshold-exceeded',
            payloadRedacted: {
              summaryId: 'summary-1',
              membershipId: 'employee-1',
              managerMembershipIds: ['manager-1'],
              yearMonth: '2026-07',
            },
          },
        ]),
        markOutboxSent: vi.fn(),
      } as never,
      { publishActionItemChanged: vi.fn(), publishProgressChanged: vi.fn() },
      { notify },
    );

    await dispatcher.dispatch('worker-1');

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'manager-1',
        dedupeKey: 'event-1:manager-1',
        type: 'absence.summary.threshold-exceeded',
      }),
    );
  });
});
