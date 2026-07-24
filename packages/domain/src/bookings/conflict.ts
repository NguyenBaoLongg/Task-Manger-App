import type { BookingStatus, BookingType, BookingWindow } from './types.js';

const ACTIVE_SLOT_STATUSES = new Set<BookingStatus>(['SCHEDULED', 'ARRIVED']);
export const BOOKING_START_SEPARATION_MS = 60 * 60 * 1_000;

export function blocksBookingSlot(input: {
  readonly type: BookingType;
  readonly status: BookingStatus;
}): boolean {
  return input.type === 'SCHEDULED' && ACTIVE_SLOT_STATUSES.has(input.status);
}

export function hasBookingConflict(
  requestedStart: Date,
  existing: readonly BookingWindow[],
): boolean {
  const requestedTime = requestedStart.getTime();
  return existing.some(
    (booking) =>
      blocksBookingSlot(booking) &&
      Math.abs(booking.startsAt.getTime() - requestedTime) < BOOKING_START_SEPARATION_MS,
  );
}
