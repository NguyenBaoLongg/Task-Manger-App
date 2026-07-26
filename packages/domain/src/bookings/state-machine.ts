import { ProblemError } from '../foundation.js';
import type { BookingStatus } from './types.js';

export type BookingOutcome = 'NO_SHOW' | 'CANCELLED';
export type ReasonApplicability = 'cancel' | 'reschedule';

export interface ReasonVersionLike {
  readonly id: string;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly appliesToCancellation: boolean;
  readonly appliesToReschedule: boolean;
}

export function resolveReasonVersion<T extends ReasonVersionLike>(
  versions: readonly T[],
  at: Date,
  applicability: ReasonApplicability,
) {
  return (
    versions
      .filter((version) => {
        const applicable =
          applicability === 'cancel' ? version.appliesToCancellation : version.appliesToReschedule;
        return (
          version.status === 'ACTIVE' &&
          applicable &&
          version.effectiveFrom <= at &&
          (version.effectiveTo === null || version.effectiveTo > at)
        );
      })
      .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())[0] ??
    null
  );
}

export function decideBookingOutcome(input: {
  status: BookingStatus;
  stateVersion: number;
  expectedStateVersion: number;
  outcome: BookingOutcome;
}) {
  if (input.stateVersion !== input.expectedStateVersion) {
    throw new ProblemError(409, 'CONFLICT', 'Booking state version has changed.');
  }
  if (input.status !== 'SCHEDULED' && input.status !== 'ARRIVED') {
    throw new ProblemError(422, 'BUSINESS_RULE_VIOLATION', 'Booking is already terminal.');
  }
  return { nextStatus: input.outcome, nextStateVersion: input.stateVersion + 1 } as const;
}

export function decideReschedule(input: {
  status: BookingStatus;
  stateVersion: number;
  expectedStateVersion: number;
}) {
  if (input.stateVersion !== input.expectedStateVersion) {
    throw new ProblemError(409, 'CONFLICT', 'Booking state version has changed.');
  }
  if (input.status !== 'SCHEDULED') {
    throw new ProblemError(
      422,
      'BUSINESS_RULE_VIOLATION',
      'Only scheduled bookings can be rescheduled.',
    );
  }
  return { nextStatus: 'RESCHEDULED' as const, nextStateVersion: input.stateVersion + 1 };
}
