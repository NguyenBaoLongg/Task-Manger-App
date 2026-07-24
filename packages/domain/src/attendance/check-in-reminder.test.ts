import { describe, expect, it } from 'vitest';
import {
  buildCheckInReminderMessage,
  finalCheckInReminderLocalTime,
  isFinalCheckInReminderDue,
  reminderTargetStartLocalTime,
  type PendingCheckInReminderRecipient,
} from './check-in-reminder.js';

const baseRecipient: PendingCheckInReminderRecipient = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  membershipId: '30000000-0000-4000-8000-000000000001',
  branchId: '00000040-0000-4000-8000-000000000001',
  businessDate: '2026-07-24',
  scheduleVersionId: '40000000-0000-4000-8000-000000000001',
  shiftDefinitionId: '50000000-0000-4000-8000-000000000001',
  shiftCode: 'SHIFT_0830',
  shiftStartLocalTime: '08:30',
  membershipDisplayName: 'An Nguyen',
};

describe('check-in reminder', () => {
  it('targets the shift that starts 15 minutes after the reminder tick', () => {
    expect(
      reminderTargetStartLocalTime({
        now: new Date('2026-07-24T01:15:00.000Z'),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).toBe('08:30');
  });

  it('targets the final warning one hour before the 12:00 cutoff', () => {
    expect(finalCheckInReminderLocalTime()).toBe('11:00');
    expect(
      isFinalCheckInReminderDue({
        now: new Date('2026-07-24T04:00:30.000Z'),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).toBe(true);
    expect(
      isFinalCheckInReminderDue({
        now: new Date('2026-07-24T04:01:00.000Z'),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).toBe(false);
  });

  it('tags unchecked-in scheduled members once with a stable dedupe key', () => {
    const reminder = buildCheckInReminderMessage({
      reminderAt: new Date('2026-07-24T01:15:00.000Z'),
      recipients: [
        {
          ...baseRecipient,
          membershipId: '30000000-0000-4000-8000-000000000002',
          scheduleVersionId: '40000000-0000-4000-8000-000000000002',
          membershipDisplayName: 'Binh Tran',
        },
        baseRecipient,
        baseRecipient,
      ],
    });

    expect(reminder).toMatchObject({
      tenantId: baseRecipient.tenantId,
      branchId: baseRecipient.branchId,
      businessDate: '2026-07-24',
      shiftStartLocalTime: '08:30',
      mentionMembershipIds: [
        '30000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000002',
      ],
      mentionDisplayNames: ['An Nguyen', 'Binh Tran'],
      dedupeKey:
        'attendance-checkin-reminder:10000000-0000-4000-8000-000000000001:00000040-0000-4000-8000-000000000001:2026-07-24:50000000-0000-4000-8000-000000000001:15',
    });
    expect(reminder?.messageBody).toBe(
      'Nhắc check-in ca 08:30: @An Nguyen, @Binh Tran chưa check-in video.',
    );
  });

  it('builds a final noon warning without changing the pre-shift dedupe shape', () => {
    const reminder = buildCheckInReminderMessage({
      reminderAt: new Date('2026-07-24T04:00:00.000Z'),
      reminderKind: 'NOON_FINAL',
      leadMinutes: 60,
      cutoffLocalTime: '12:00',
      recipients: [baseRecipient],
    });

    expect(reminder).toMatchObject({
      reminderKind: 'NOON_FINAL',
      cutoffLocalTime: '12:00',
      mentionDisplayNames: ['An Nguyen'],
      dedupeKey:
        'attendance-checkin-reminder-final:10000000-0000-4000-8000-000000000001:00000040-0000-4000-8000-000000000001:2026-07-24:50000000-0000-4000-8000-000000000001:12:00:60',
    });
    expect(reminder?.messageBody).toBe(
      'Nhắc check-in lần cuối trước 12:00 ca 08:30: @An Nguyen chưa check-in video. Sau 12:00 sẽ tính lỗi không check-in và phạt theo policy nếu không có OFF/nghỉ hợp lệ.',
    );
  });

  it('rejects mixed branch or shift groups so reminders do not leak tenant data', () => {
    expect(() =>
      buildCheckInReminderMessage({
        reminderAt: new Date('2026-07-24T01:15:00.000Z'),
        recipients: [
          baseRecipient,
          {
            ...baseRecipient,
            membershipId: '30000000-0000-4000-8000-000000000002',
            branchId: '00000040-0000-4000-8000-000000000002',
          },
        ],
      }),
    ).toThrow('CHECKIN_REMINDER_GROUP_SCOPE_MISMATCH');
  });
});
