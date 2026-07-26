import { describe, expect, it } from 'vitest';
import { BookingService } from '../../src/modules/bookings/booking-service.js';
import { FormValidator } from '../../src/modules/forms/form-validator.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000001';
const bookingId = '40000000-0000-4000-8000-000000000001';
const branchA = '50000000-0000-4000-8000-000000000001';
const branchB = '50000000-0000-4000-8000-000000000002';

function createService(permission: string, scope = { tenantWide: false, branchIds: [branchA] }) {
  const repository = {
    getBooking: async (input: { allowedBranchIds: string[] | null }) =>
      input.allowedBranchIds !== null && !input.allowedBranchIds.includes(branchB)
        ? null
        : { id: bookingId, branchId: branchB, status: 'SCHEDULED', stateVersion: 1 },
    recordBookingOutcome: async () => ({ id: bookingId }),
    rescheduleBooking: async () => ({
      source: { id: bookingId },
      replacement: { id: 'replacement' },
    }),
    correctBookingOutcome: async () => ({ id: bookingId }),
  };
  const authorization = {
    resolvePermissionScope: async (_tenantId: string, _membershipId: string, requested: string) => {
      if (requested === permission && permission === 'booking.outcome.correct') {
        throw Object.assign(new Error('denied'), { status: 403, code: 'AUTHORIZATION_DENIED' });
      }
      return scope;
    },
  };
  return new BookingService(repository as never, authorization as never, new FormValidator());
}

describe('US3 tenant and branch authorization', () => {
  it('does not allow an actor scoped to branch A to mutate branch B', async () => {
    const service = createService('booking.outcome.manage');
    await expect(
      service.recordOutcome({
        tenantId,
        actorMembershipId: membershipId,
        bookingId,
        outcome: 'NO_SHOW',
        reasonVersionId: '60000000-0000-4000-8000-000000000001',
        expectedStateVersion: 1,
        correlationId: 'isolation',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'RESOURCE_NOT_FOUND' });
  });

  it('requires a distinct privileged permission for correction', async () => {
    const service = createService('booking.outcome.correct');
    await expect(
      service.correctOutcome({
        tenantId,
        actorMembershipId: membershipId,
        bookingId,
        outcome: 'CANCELLED',
        reasonVersionId: '60000000-0000-4000-8000-000000000001',
        expectedStateVersion: 1,
        correlationId: 'correction',
      }),
    ).rejects.toMatchObject({ status: 403, code: 'AUTHORIZATION_DENIED' });
  });
});
