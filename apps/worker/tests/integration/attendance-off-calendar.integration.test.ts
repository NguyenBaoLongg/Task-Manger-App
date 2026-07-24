import { describe, expect, it, vi } from 'vitest';
import { AttendanceDayCloseRunner } from '../../src/attendance/day-close-runner.js';

const businessDate = new Date('2026-07-24T00:00:00.000Z');

describe('attendance OFF calendar integration harness', () => {
  it('suppresses missing-check-in close, penalty and action-item projection on OFF days', async () => {
    const repository = {
      isOffCalendarDay: vi.fn(async () => true),
      listDayCloseCandidates: vi.fn(async () => {
        throw new Error('OFF day should stop before candidate scan');
      }),
      createMissingCheckInEvent: vi.fn(),
    };
    const penalties = { assessMissingCheckInEvent: vi.fn() };
    const actionItems = { projectAttendanceSource: vi.fn() };
    const runner = new AttendanceDayCloseRunner(
      repository as never,
      penalties as never,
      actionItems as never,
    );

    await expect(
      runner.runTenantDay({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        businessDate,
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).resolves.toEqual({
      processed: 0,
      missingCheckIns: 0,
      nonWorked: 0,
      suppressedByOffCalendar: 1,
    });

    expect(penalties.assessMissingCheckInEvent).not.toHaveBeenCalled();
    expect(actionItems.projectAttendanceSource).not.toHaveBeenCalled();
  });
});
