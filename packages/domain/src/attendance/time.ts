import type { AttendanceState, DayWorkClassification } from './types.js';

const timezoneOffsets: Record<string, number> = {
  'Asia/Ho_Chi_Minh': 7 * 60,
  'Asia/Saigon': 7 * 60,
  UTC: 0,
};

function localMinutes(value: Date, timezone: string): number {
  const offset = timezoneOffsets[timezone] ?? 0;
  const local = new Date(value.getTime() + offset * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function calculateLate(shiftStartAt: Date, checkInAt: Date) {
  const lateSeconds = Math.floor(Math.max(0, checkInAt.getTime() - shiftStartAt.getTime()) / 1_000);
  return {
    lateSeconds,
    lateMinutes: Math.floor(lateSeconds / 60),
  };
}

export function localTimeFlags(value: Date, timezone: string) {
  const minutes = localMinutes(value, timezone);
  return {
    after15Local: minutes >= 15 * 60,
    after18Local: minutes >= 18 * 60,
  };
}

export function classifyAttendanceDay(input: {
  hasCheckIn: boolean;
  lateMinutes?: number;
  checkInAt?: Date;
  now?: Date;
  timezone: string;
}): { classification: DayWorkClassification; state: AttendanceState; reason: string } {
  if (input.hasCheckIn) {
    const lateMinutes = input.lateMinutes ?? 0;
    return lateMinutes > 0
      ? { classification: 'WORKED_LATE', state: 'CONFIRMED', reason: 'CHECKED_IN_LATE' }
      : { classification: 'WORKED_ON_TIME', state: 'CONFIRMED', reason: 'CHECKED_IN_ON_TIME' };
  }
  const now = input.now ?? new Date();
  if (localTimeFlags(now, input.timezone).after18Local) {
    return {
      classification: 'NON_WORKED_NO_CHECKIN',
      state: 'NON_WORKED',
      reason: 'NO_CHECKIN_AFTER_18_LOCAL',
    };
  }
  return {
    classification: 'NON_WORKED_NO_CHECKIN',
    state: 'MISSING_CHECK_IN',
    reason: 'NO_CHECKIN_BEFORE_DAY_CLOSE',
  };
}

export function shouldCreateQueueImpact(input: {
  lateMinutes: number;
  classification: DayWorkClassification;
}): boolean {
  return input.classification === 'WORKED_LATE' && input.lateMinutes > 0;
}
