import { describe, expect, it } from 'vitest';
import { BookingService } from '../../src/modules/bookings/booking-service.js';
import { FormValidator } from '../../src/modules/forms/form-validator.js';
import { hasBookingConflict } from '@adsup/domain';

const branchId = '20000000-0000-4000-8000-000000000001';
const employeeId = '50000000-0000-4000-8000-000000000001';

function serviceWithExisting(
  status: 'SCHEDULED' | 'CANCELLED',
  metrics?: { increment(name: string): void },
) {
  const repository = {
    getCustomerForBranch: async () => ({ id: '30000000-0000-4000-8000-000000000001' }),
    getEffectiveService: async () => ({
      id: '40000000-0000-4000-8000-000000000002',
      serviceOfferingId: '40000000-0000-4000-8000-000000000001',
      code: 'FACIAL',
      name: 'Facial',
    }),
    getEffectiveAssignment: async () => ({ membershipId: employeeId }),
    getPublishedFormVersion: async () => ({
      id: '60000000-0000-4000-8000-000000000002',
      formTemplateId: '60000000-0000-4000-8000-000000000001',
      status: 'PUBLISHED',
      jsonSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
      },
    }),
    getBookingTimezone: async () => 'Asia/Ho_Chi_Minh',
    findBookingConflict: async (input: { scheduledStartAt: Date }) =>
      hasBookingConflict(input.scheduledStartAt, [
        {
          type: 'SCHEDULED',
          status,
          startsAt: new Date('2026-07-25T09:00:00.000Z'),
        },
      ])
        ? { id: 'conflict' }
        : null,
    createScheduledBooking: async () => ({ id: 'created' }),
  };
  return new BookingService(
    repository as never,
    {
      resolvePermissionScope: async () => ({ tenantWide: false, branchIds: [branchId] }),
    } as never,
    new FormValidator(),
    metrics,
  );
}

function input(scheduledStartAt: string) {
  return {
    tenantId: '10000000-0000-4000-8000-000000000001',
    actorMembershipId: employeeId,
    correlationId: 'booking-conflict',
    idempotencyKey: `booking-${scheduledStartAt}`,
    branchId,
    customerId: '30000000-0000-4000-8000-000000000001',
    serviceOfferingId: '40000000-0000-4000-8000-000000000001',
    assignedMembershipId: employeeId,
    scheduledStartAt: new Date(scheduledStartAt),
    formTemplateId: '60000000-0000-4000-8000-000000000001',
    formVersionId: '60000000-0000-4000-8000-000000000002',
    formData: {},
  };
}

describe('booking 60-minute conflict', () => {
  it('rejects 59 minutes and accepts exactly 60 minutes', async () => {
    const service = serviceWithExisting('SCHEDULED');
    await expect(service.createScheduled(input('2026-07-25T09:59:00.000Z'))).rejects.toMatchObject({
      code: 'BOOKING_CONFLICT',
    });
    await expect(service.createScheduled(input('2026-07-25T10:00:00.000Z'))).resolves.toMatchObject(
      { id: 'created' },
    );
  });

  it('ignores terminal bookings', async () => {
    await expect(
      serviceWithExisting('CANCELLED').createScheduled(input('2026-07-25T09:30:00.000Z')),
    ).resolves.toMatchObject({ id: 'created' });
  });

  it('records a conflict metric without customer PII', async () => {
    const names: string[] = [];
    const service = serviceWithExisting('SCHEDULED', {
      increment: (name) => names.push(name),
    });
    await expect(service.createScheduled(input('2026-07-25T09:30:00.000Z'))).rejects.toMatchObject({
      code: 'BOOKING_CONFLICT',
    });
    expect(names).toEqual(['booking_conflicts_total']);
  });
});
