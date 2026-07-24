import { describe, expect, it, vi } from 'vitest';
import { CheckInReminderRunner } from '../../src/attendance/check-in-reminder-runner.js';

describe('check-in reminder runner', () => {
  it('emits one reminder 15 minutes before a shift for members without check-in', async () => {
    const emitCheckInReminder = vi.fn();
    const listFinalCheckInReminderRecipients = vi.fn().mockResolvedValue([]);
    const runner = new CheckInReminderRunner({
      listPendingCheckInReminderRecipients: vi.fn().mockResolvedValue([
        {
          tenantId: '10000000-0000-4000-8000-000000000001',
          membershipId: '30000000-0000-4000-8000-000000000001',
          branchId: '00000040-0000-4000-8000-000000000001',
          businessDate: '2026-07-24',
          scheduleVersionId: '40000000-0000-4000-8000-000000000001',
          shiftDefinitionId: '50000000-0000-4000-8000-000000000001',
          shiftCode: 'SHIFT_0830',
          shiftStartLocalTime: '08:30',
          membershipDisplayName: 'An Nguyen',
        },
        {
          tenantId: '10000000-0000-4000-8000-000000000001',
          membershipId: '30000000-0000-4000-8000-000000000002',
          branchId: '00000040-0000-4000-8000-000000000001',
          businessDate: '2026-07-24',
          scheduleVersionId: '40000000-0000-4000-8000-000000000002',
          shiftDefinitionId: '50000000-0000-4000-8000-000000000001',
          shiftCode: 'SHIFT_0830',
          shiftStartLocalTime: '08:30',
          membershipDisplayName: 'Binh Tran',
        },
      ]),
      listFinalCheckInReminderRecipients,
      emitCheckInReminder,
    });

    await expect(
      runner.runTenant({
        tenantId: '10000000-0000-4000-8000-000000000001',
        businessDate: '2026-07-24',
        now: new Date('2026-07-24T01:15:00.000Z'),
      }),
    ).resolves.toEqual({ processed: 2, reminders: 1, targetStartLocalTime: '08:30' });
    expect(emitCheckInReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        mentionDisplayNames: ['An Nguyen', 'Binh Tran'],
        messageBody: 'Nhắc check-in ca 08:30: @An Nguyen, @Binh Tran chưa check-in video.',
      }),
    );
    expect(listFinalCheckInReminderRecipients).not.toHaveBeenCalled();
  });

  it('emits the final warning one hour before noon for members still missing check-in', async () => {
    const emitCheckInReminder = vi.fn();
    const listPendingCheckInReminderRecipients = vi.fn().mockResolvedValue([]);
    const listFinalCheckInReminderRecipients = vi.fn().mockResolvedValue([
      {
        tenantId: '10000000-0000-4000-8000-000000000001',
        membershipId: '30000000-0000-4000-8000-000000000001',
        branchId: '00000040-0000-4000-8000-000000000001',
        businessDate: '2026-07-24',
        scheduleVersionId: '40000000-0000-4000-8000-000000000001',
        shiftDefinitionId: '50000000-0000-4000-8000-000000000001',
        shiftCode: 'SHIFT_0830',
        shiftStartLocalTime: '08:30',
        membershipDisplayName: 'An Nguyen',
      },
    ]);
    const runner = new CheckInReminderRunner({
      listPendingCheckInReminderRecipients,
      listFinalCheckInReminderRecipients,
      emitCheckInReminder,
    });

    await expect(
      runner.runTenant({
        tenantId: '10000000-0000-4000-8000-000000000001',
        businessDate: '2026-07-24',
        now: new Date('2026-07-24T04:00:00.000Z'),
      }),
    ).resolves.toEqual({ processed: 1, reminders: 1, targetStartLocalTime: '11:15' });
    expect(listPendingCheckInReminderRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ targetStartLocalTime: '11:15' }),
    );
    expect(listFinalCheckInReminderRecipients).toHaveBeenCalledWith({
      tenantId: '10000000-0000-4000-8000-000000000001',
      businessDate: '2026-07-24',
      take: undefined,
    });
    expect(emitCheckInReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderKind: 'NOON_FINAL',
        cutoffLocalTime: '12:00',
        messageBody:
          'Nhắc check-in lần cuối trước 12:00 ca 08:30: @An Nguyen chưa check-in video. Sau 12:00 sẽ tính lỗi không check-in và phạt theo policy nếu không có OFF/nghỉ hợp lệ.',
      }),
    );
  });
});
