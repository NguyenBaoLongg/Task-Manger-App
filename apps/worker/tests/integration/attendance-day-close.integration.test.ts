import { describe, expect, it, vi } from 'vitest';
import { AttendanceDayCloseRunner } from '../../src/attendance/day-close-runner.js';

const businessDate = new Date('2026-07-24T00:00:00.000Z');

describe('attendance day close integration harness', () => {
  it('creates a missing-check-in event, penalty assessment and action item at the 12:00 cutoff', async () => {
    const attendanceEvent = {
      tenantId: 'tenant-1',
      id: 'attendance-1',
      membershipId: 'member-1',
      branchId: 'branch-1',
      businessDate,
      state: 'MISSING_CHECK_IN',
      dayClassification: 'NON_WORKED_NO_CHECKIN',
    };
    const repository = {
      isOffCalendarDay: vi.fn(async () => false),
      listDayCloseCandidates: vi.fn(async () => [
        {
          tenantId: 'tenant-1',
          membershipId: 'member-1',
          branchId: 'branch-1',
          businessDate,
          scheduleVersionId: 'schedule-1',
          shiftDefinitionId: 'shift-1',
        },
      ]),
      createMissingCheckInEvent: vi.fn(async () => attendanceEvent),
    };
    const penalties = {
      assessMissingCheckInEvent: vi.fn(async () => ({ id: 'settlement-1' })),
    };
    const actionItems = {
      projectAttendanceSource: vi.fn(async () => ({ id: 'action-1' })),
    };
    const runner = new AttendanceDayCloseRunner(
      repository as never,
      penalties as never,
      actionItems as never,
    );

    await expect(
      runner.runTenantDay({
        tenantId: 'tenant-1',
        businessDate,
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).resolves.toEqual({
      processed: 1,
      missingCheckIns: 1,
      nonWorked: 1,
      suppressedByOffCalendar: 0,
    });

    expect(repository.createMissingCheckInEvent).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleVersionId: 'schedule-1' }),
    );
    expect(penalties.assessMissingCheckInEvent).toHaveBeenCalledWith(
      expect.objectContaining({ attendanceEventId: 'attendance-1' }),
    );
    expect(actionItems.projectAttendanceSource).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'ATTENDANCE_MISSING_CHECKIN' }),
    );
  });
});
