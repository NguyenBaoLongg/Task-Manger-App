import { describe, expect, it } from 'vitest';
import { blocksBookingSlot, hasBookingConflict } from './conflict.js';

const at = (value: string) => new Date(`2026-07-24T${value}:00.000Z`);

describe('booking 60-minute conflict', () => {
  it('rejects 59 minutes and accepts exactly 60 minutes', () => {
    const existing = [{ type: 'SCHEDULED', status: 'SCHEDULED', startsAt: at('09:00') }] as const;
    expect(hasBookingConflict(at('09:59'), existing)).toBe(true);
    expect(hasBookingConflict(at('10:00'), existing)).toBe(false);
  });

  it('only lets active scheduled bookings occupy the slot', () => {
    expect(blocksBookingSlot({ type: 'WALK_IN', status: 'ARRIVED' })).toBe(false);
    expect(blocksBookingSlot({ type: 'SCHEDULED', status: 'CANCELLED' })).toBe(false);
    expect(blocksBookingSlot({ type: 'SCHEDULED', status: 'NO_SHOW' })).toBe(false);
    expect(blocksBookingSlot({ type: 'SCHEDULED', status: 'RESCHEDULED' })).toBe(false);
    expect(blocksBookingSlot({ type: 'SCHEDULED', status: 'SCHEDULED' })).toBe(true);
    expect(blocksBookingSlot({ type: 'SCHEDULED', status: 'ARRIVED' })).toBe(true);
  });

  it('checks both sides of the requested start time', () => {
    const existing = [{ type: 'SCHEDULED', status: 'ARRIVED', startsAt: at('10:00') }] as const;
    expect(hasBookingConflict(at('09:01'), existing)).toBe(true);
    expect(hasBookingConflict(at('09:00'), existing)).toBe(false);
  });
});
