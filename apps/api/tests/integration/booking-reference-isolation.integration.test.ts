import { describe, expect, it } from 'vitest';
import { BookingService } from '../../src/modules/bookings/booking-service.js';
import { FormValidator } from '../../src/modules/forms/form-validator.js';

const valid = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  actorMembershipId: '50000000-0000-4000-8000-000000000001',
  correlationId: 'booking-references',
  idempotencyKey: 'booking-reference-key',
  branchId: '20000000-0000-4000-8000-000000000001',
  customerId: '30000000-0000-4000-8000-000000000001',
  serviceOfferingId: '40000000-0000-4000-8000-000000000001',
  assignedMembershipId: '50000000-0000-4000-8000-000000000001',
  scheduledStartAt: new Date('2026-07-25T09:00:00.000Z'),
  formTemplateId: '60000000-0000-4000-8000-000000000001',
  formVersionId: '60000000-0000-4000-8000-000000000002',
  formData: {},
};

function serviceWithForeign(reference: 'customer' | 'service' | 'employee' | 'form') {
  const repository = {
    getCustomerForBranch: async () => (reference === 'customer' ? null : { id: valid.customerId }),
    getEffectiveService: async () =>
      reference === 'service'
        ? null
        : {
            id: '40000000-0000-4000-8000-000000000002',
            serviceOfferingId: valid.serviceOfferingId,
            code: 'FACIAL',
            name: 'Facial',
          },
    getEffectiveAssignment: async () =>
      reference === 'employee' ? null : { membershipId: valid.assignedMembershipId },
    getPublishedFormVersion: async () =>
      reference === 'form'
        ? null
        : {
            id: valid.formVersionId,
            formTemplateId: valid.formTemplateId,
            status: 'PUBLISHED',
            jsonSchema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              type: 'object',
            },
          },
    getBookingTimezone: async () => 'Asia/Ho_Chi_Minh',
    findBookingConflict: async () => null,
    createScheduledBooking: async () => ({ id: 'created' }),
  };
  return new BookingService(
    repository as never,
    {
      resolvePermissionScope: async () => ({ tenantWide: false, branchIds: [valid.branchId] }),
    } as never,
    new FormValidator(),
  );
}

describe('booking reference tenant isolation', () => {
  it.each(['customer', 'service', 'employee', 'form'] as const)(
    'does not disclose a foreign %s identifier',
    async (reference) => {
      await expect(serviceWithForeign(reference).createScheduled(valid)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    },
  );
});
