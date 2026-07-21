import { describe, expect, it } from 'vitest';
import {
  calculateLate,
  classifyAttendanceDay,
  localTimeFlags,
  shouldCreateQueueImpact,
} from './time.js';

describe('attendance time calculation', () => {
  const shiftStartAt = new Date('2026-07-21T01:30:00.000Z');

  it('rounds late minutes down from server check-in timestamp', () => {
    expect(calculateLate(shiftStartAt, new Date('2026-07-21T01:30:59.000Z')).lateMinutes).toBe(0);
    expect(calculateLate(shiftStartAt, new Date('2026-07-21T01:45:59.000Z')).lateMinutes).toBe(15);
    expect(calculateLate(shiftStartAt, new Date('2026-07-21T01:46:00.000Z')).lateMinutes).toBe(16);
  });

  it('classifies after 15:00 as worked late and no check-in after 18:00 as non-worked', () => {
    const after15 = new Date('2026-07-21T08:01:00.000Z');
    expect(localTimeFlags(after15, 'Asia/Ho_Chi_Minh')).toMatchObject({
      after15Local: true,
      after18Local: false,
    });
    expect(
      classifyAttendanceDay({
        hasCheckIn: true,
        lateMinutes: 391,
        checkInAt: after15,
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).toEqual({ classification: 'WORKED_LATE', state: 'CONFIRMED', reason: 'CHECKED_IN_LATE' });

    expect(
      classifyAttendanceDay({
        hasCheckIn: false,
        now: new Date('2026-07-21T11:01:00.000Z'),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).toEqual({
      classification: 'NON_WORKED_NO_CHECKIN',
      state: 'NON_WORKED',
      reason: 'NO_CHECKIN_AFTER_18_LOCAL',
    });
  });

  it('creates queue impact only for worked late days', () => {
    expect(shouldCreateQueueImpact({ lateMinutes: 1, classification: 'WORKED_LATE' })).toBe(true);
    expect(shouldCreateQueueImpact({ lateMinutes: 0, classification: 'WORKED_ON_TIME' })).toBe(
      false,
    );
  });
});
