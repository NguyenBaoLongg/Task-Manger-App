import { describe, expect, it } from 'vitest';
import {
  countAbsenceDays,
  evaluateConsecutiveLeaveRule,
  expandLeaveDates,
  findLeaveConflict,
  resolveOffCalendar,
} from './absence.js';

describe('attendance absence rules', () => {
  it('resolves tenant-wide and branch-specific OFF calendars by business date', () => {
    const calendars = [
      {
        id: 'tenant-off',
        scopeType: 'TENANT' as const,
        branchId: null,
        startDate: '2026-07-20',
        endDate: '2026-07-21',
      },
      {
        id: 'branch-off',
        scopeType: 'BRANCH' as const,
        branchId: 'branch-2',
        startDate: '2026-07-22',
        endDate: '2026-07-22',
      },
    ];
    expect(
      resolveOffCalendar({ calendars, branchId: 'branch-1', businessDate: '2026-07-21' }),
    ).toMatchObject({
      applies: true,
      calendarId: 'tenant-off',
    });
    expect(
      resolveOffCalendar({ calendars, branchId: 'branch-1', businessDate: '2026-07-22' }),
    ).toMatchObject({
      applies: false,
    });
    expect(
      resolveOffCalendar({ calendars, branchId: 'branch-2', businessDate: '2026-07-22' }),
    ).toMatchObject({
      applies: true,
      calendarId: 'branch-off',
    });
  });

  it('expands leave ranges and counts morning half-day as 0.5 day', () => {
    expect(
      expandLeaveDates({
        durationKind: 'DATE_RANGE',
        startDate: '2026-07-21',
        endDate: '2026-07-23',
      }),
    ).toEqual(['2026-07-21', '2026-07-22', '2026-07-23']);
    expect(
      countAbsenceDays([
        { durationKind: 'FULL_DAY', startDate: '2026-07-21', endDate: '2026-07-21' },
        { durationKind: 'MORNING_HALF', startDate: '2026-07-22', endDate: '2026-07-22' },
      ]),
    ).toBe(1.5);
  });

  it('flags consecutive personal leave unless an approved exception is present', () => {
    const violation = evaluateConsecutiveLeaveRule({
      requestedDates: ['2026-07-22'],
      existingLeaveDates: ['2026-07-21'],
      hasApprovedException: false,
    });
    expect(violation).toEqual({ allowed: false, violationKind: 'CONSECUTIVE_DAYS' });
    expect(
      evaluateConsecutiveLeaveRule({
        requestedDates: ['2026-07-22'],
        existingLeaveDates: ['2026-07-21'],
        hasApprovedException: true,
      }),
    ).toEqual({ allowed: true });
  });

  it('detects same branch department or position leave conflicts', () => {
    const conflict = findLeaveConflict({
      request: {
        membershipId: 'member-1',
        branchId: 'branch-1',
        departmentId: 'dept-1',
        positionId: 'position-1',
        dates: ['2026-07-21'],
      },
      existing: [
        {
          requestId: 'request-2',
          membershipId: 'member-2',
          branchId: 'branch-1',
          departmentId: 'dept-1',
          positionId: 'position-9',
          dates: ['2026-07-21'],
        },
      ],
    });
    expect(conflict).toEqual({
      result: 'CONFLICT',
      conflictingRequestId: 'request-2',
      conflictingMembershipId: 'member-2',
      businessDate: '2026-07-21',
    });
  });
});
