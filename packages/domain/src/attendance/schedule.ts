import { ProblemError } from '../foundation.js';

export type ScheduleChangeOutcome =
  | { outcome: 'DIRECT_SELF_EDIT' }
  | { outcome: 'APPROVAL_REQUIRED' }
  | { outcome: 'MANAGER_REQUIRED' };

const timezoneOffsets: Record<string, number> = {
  'Asia/Ho_Chi_Minh': 7 * 60,
  'Asia/Saigon': 7 * 60,
  UTC: 0,
};

export function shiftStartInstant(input: {
  businessDate: string;
  startLocalTime: string;
  timezone: string;
}): Date {
  const [year, month, day] = input.businessDate.split('-').map(Number);
  const [hour, minute] = input.startLocalTime.split(':').map(Number);
  if (!year || !month || !day || hour === undefined || minute === undefined) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'NgÃ y hoáº·c giá» ca khÃ´ng há»£p lá»‡.');
  }
  const offsetMinutes = timezoneOffsets[input.timezone];
  if (offsetMinutes === undefined) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'MÃºi giá» ca chÆ°a Ä‘Æ°á»£c há»— trá»£.');
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000);
}

export function classifyScheduleChange(input: {
  now: Date;
  shiftStartAt: Date;
  hasExistingSchedule: boolean;
}): ScheduleChangeOutcome {
  const millisecondsUntilStart = input.shiftStartAt.getTime() - input.now.getTime();
  if (millisecondsUntilStart <= 0) return { outcome: 'MANAGER_REQUIRED' };
  if (!input.hasExistingSchedule) return { outcome: 'DIRECT_SELF_EDIT' };
  return millisecondsUntilStart > 24 * 60 * 60 * 1_000
    ? { outcome: 'DIRECT_SELF_EDIT' }
    : { outcome: 'APPROVAL_REQUIRED' };
}

export function nextScheduleVersion(previous?: { versionNumber: number } | null): number {
  return (previous?.versionNumber ?? 0) + 1;
}
