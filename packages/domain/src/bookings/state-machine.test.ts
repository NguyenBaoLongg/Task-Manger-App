import { describe, expect, it } from 'vitest';
import { ProblemError } from '../foundation.js';
import { decideBookingOutcome, decideReschedule, resolveReasonVersion } from './state-machine.js';

const at = new Date('2026-07-25T09:00:00.000Z');

describe('booking outcome state machine', () => {
  it('allows terminal outcome only from an active scheduled booking', () => {
    expect(
      decideBookingOutcome({
        status: 'SCHEDULED',
        stateVersion: 2,
        expectedStateVersion: 2,
        outcome: 'NO_SHOW',
      }),
    ).toEqual({ nextStatus: 'NO_SHOW', nextStateVersion: 3 });
    expect(() =>
      decideBookingOutcome({
        status: 'CANCELLED',
        stateVersion: 2,
        expectedStateVersion: 2,
        outcome: 'NO_SHOW',
      }),
    ).toThrow(ProblemError);
  });

  it('rejects stale state versions', () => {
    expect(() =>
      decideReschedule({ status: 'SCHEDULED', stateVersion: 3, expectedStateVersion: 2 }),
    ).toThrowError(/version/i);
  });

  it('resolves an effective active reason and enforces applicability', () => {
    const reason = resolveReasonVersion(
      [
        {
          id: 'old',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: at,
          appliesToCancellation: true,
          appliesToReschedule: false,
        },
        {
          id: 'new',
          status: 'ACTIVE',
          effectiveFrom: at,
          effectiveTo: null,
          appliesToCancellation: true,
          appliesToReschedule: true,
        },
      ],
      at,
      'reschedule',
    );
    expect(reason?.id).toBe('new');
    expect(resolveReasonVersion([], at, 'cancel')).toBeNull();
  });
});
