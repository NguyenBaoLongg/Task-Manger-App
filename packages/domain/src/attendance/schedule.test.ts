import { describe, expect, it } from 'vitest';
import { classifyScheduleChange, nextScheduleVersion, shiftStartInstant } from './schedule.js';

describe('attendance schedule rules', () => {
  it('converts tenant local shift start to UTC instant', () => {
    expect(
      shiftStartInstant({
        businessDate: '2026-07-21',
        startLocalTime: '08:30',
        timezone: 'Asia/Ho_Chi_Minh',
      }).toISOString(),
    ).toBe('2026-07-21T01:30:00.000Z');
  });

  it('allows first registration before shift start and blocks after start', () => {
    const shiftStartAt = new Date('2026-07-21T01:30:00.000Z');
    expect(
      classifyScheduleChange({
        now: new Date('2026-07-21T01:00:00.000Z'),
        shiftStartAt,
        hasExistingSchedule: false,
      }),
    ).toEqual({ outcome: 'DIRECT_SELF_EDIT' });
    expect(
      classifyScheduleChange({
        now: new Date('2026-07-21T01:31:00.000Z'),
        shiftStartAt,
        hasExistingSchedule: false,
      }),
    ).toEqual({ outcome: 'MANAGER_REQUIRED' });
  });

  it('allows self edit strictly more than 24 hours before start and requires approval inside cutoff', () => {
    const shiftStartAt = new Date('2026-07-21T01:30:00.000Z');
    expect(
      classifyScheduleChange({
        now: new Date('2026-07-20T01:29:59.999Z'),
        shiftStartAt,
        hasExistingSchedule: true,
      }),
    ).toEqual({ outcome: 'DIRECT_SELF_EDIT' });
    expect(
      classifyScheduleChange({
        now: new Date('2026-07-20T01:30:00.000Z'),
        shiftStartAt,
        hasExistingSchedule: true,
      }),
    ).toEqual({ outcome: 'APPROVAL_REQUIRED' });
  });

  it('increments schedule versions immutably', () => {
    expect(nextScheduleVersion()).toBe(1);
    expect(nextScheduleVersion({ versionNumber: 2 })).toBe(3);
  });
});
