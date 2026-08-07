import { createMutationBoundary } from '@/api/mutation-boundary';
import { createScheduledBooking, createWalkInBooking } from './booking-api';
export const createBookingActions = (
  client: Parameters<typeof createScheduledBooking>[0],
  tenantId: string,
) => {
  const boundary = createMutationBoundary({
    keyFactory: (operation = 'booking') => `${operation}-${Date.now()}`,
  });
  return {
    scheduled: (input: Omit<Parameters<typeof createScheduledBooking>[2], 'idempotencyKey'>) =>
      createScheduledBooking(client, tenantId, {
        ...input,
        idempotencyKey: boundary.headers('booking.create')['Idempotency-Key'],
      }),
    walkIn: (input: Omit<Parameters<typeof createWalkInBooking>[2], 'idempotencyKey'>) =>
      createWalkInBooking(client, tenantId, {
        ...input,
        idempotencyKey: boundary.headers('booking.walk-in')['Idempotency-Key'],
      }),
  };
};
