import { describe, expect, it } from 'vitest';
import { calculateLatePenalty, defaultAttendancePenaltyPolicy } from './late-penalty.js';

describe('late penalty calculation', () => {
  it('does not create late penalty for on-time check-in', () => {
    expect(
      calculateLatePenalty({
        lateMinutes: 0,
        monthlyLateSequence: 0,
        noticeStatus: 'NONE',
        policy: defaultAttendancePenaltyPolicy,
      }),
    ).toBeNull();
  });

  it('exempts first monthly late base amount but keeps no-notice surcharge explainable', () => {
    expect(
      calculateLatePenalty({
        lateMinutes: 10,
        monthlyLateSequence: 1,
        noticeStatus: 'NONE',
        policy: defaultAttendancePenaltyPolicy,
      }),
    ).toMatchObject({
      baseAmountMinor: 0n,
      noNoticeAmountMinor: 100_000n,
      totalAmountMinor: 100_000n,
      firstLateExempt: true,
    });
  });

  it('applies 1-15 fixed, 16-89 per-minute from minute 16, and 90+ max tiers', () => {
    expect(
      calculateLatePenalty({
        lateMinutes: 15,
        monthlyLateSequence: 2,
        noticeStatus: 'NONE',
        policy: defaultAttendancePenaltyPolicy,
      })?.baseAmountMinor,
    ).toBe(20_000n);
    expect(
      calculateLatePenalty({
        lateMinutes: 16,
        monthlyLateSequence: 2,
        noticeStatus: 'NONE',
        policy: defaultAttendancePenaltyPolicy,
      })?.baseAmountMinor,
    ).toBe(2_000n);
    expect(
      calculateLatePenalty({
        lateMinutes: 90,
        monthlyLateSequence: 2,
        noticeStatus: 'NONE',
        policy: defaultAttendancePenaltyPolicy,
      })?.baseAmountMinor,
    ).toBe(200_000n);
  });

  it('discounts approved on-time late notice by 50 percent and removes surcharge', () => {
    expect(
      calculateLatePenalty({
        lateMinutes: 20,
        monthlyLateSequence: 2,
        noticeStatus: 'APPROVED_ON_TIME',
        policy: defaultAttendancePenaltyPolicy,
      }),
    ).toMatchObject({
      baseAmountMinor: 5_000n,
      noNoticeAmountMinor: 0n,
      discountAmountMinor: 5_000n,
      totalAmountMinor: 5_000n,
    });
  });
});
