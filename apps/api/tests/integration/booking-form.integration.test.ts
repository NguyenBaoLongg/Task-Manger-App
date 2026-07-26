import { describe, expect, it } from 'vitest';
import { BookingService } from '../../src/modules/bookings/booking-service.js';
import { FormValidator } from '../../src/modules/forms/form-validator.js';
import { BookingRepository } from '@adsup/database';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  branch: '20000000-0000-4000-8000-000000000001',
  customer: '30000000-0000-4000-8000-000000000001',
  service: '40000000-0000-4000-8000-000000000001',
  membership: '50000000-0000-4000-8000-000000000001',
  template: '60000000-0000-4000-8000-000000000001',
  version: '70000000-0000-4000-8000-000000000001',
};

function createHarness(formStatus: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') {
  const writes: Array<Record<string, unknown>> = [];
  const repository = {
    getCustomerForBranch: async () => ({ id: ids.customer }),
    getEffectiveService: async () => ({
      id: '80000000-0000-4000-8000-000000000001',
      serviceOfferingId: ids.service,
      code: 'FACIAL',
      name: 'Facial',
    }),
    getEffectiveAssignment: async () => ({ membershipId: ids.membership }),
    getPublishedFormVersion: async () => ({
      id: ids.version,
      formTemplateId: ids.template,
      status: formStatus,
      jsonSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['customerNeed'],
        properties: { customerNeed: { type: 'string' } },
        additionalProperties: false,
      },
    }),
    getBookingTimezone: async () => 'Asia/Ho_Chi_Minh',
    findBookingConflict: async () => null,
    createScheduledBooking: async (input: Record<string, unknown>) => {
      writes.push(structuredClone(input));
      return { id: '90000000-0000-4000-8000-000000000001', ...input };
    },
  };
  const authorization = {
    resolvePermissionScope: async () => ({ tenantWide: false, branchIds: [ids.branch] }),
  };
  return {
    service: new BookingService(repository as never, authorization as never, new FormValidator()),
    writes,
  };
}

const baseInput = {
  tenantId: ids.tenant,
  actorMembershipId: ids.membership,
  correlationId: 'booking-form',
  idempotencyKey: 'booking-form-key',
  branchId: ids.branch,
  customerId: ids.customer,
  serviceOfferingId: ids.service,
  assignedMembershipId: ids.membership,
  scheduledStartAt: new Date('2026-07-25T09:00:00.000Z'),
  formTemplateId: ids.template,
  formVersionId: ids.version,
};

describe('booking dynamic form transaction', () => {
  it('rejects data that does not match the published FormVersion', async () => {
    const { service } = createHarness();
    await expect(service.createScheduled({ ...baseInput, formData: {} })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('rejects a non-published FormVersion', async () => {
    const { service } = createHarness('DRAFT');
    await expect(
      service.createScheduled({ ...baseInput, formData: { customerNeed: 'Skin care' } }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('passes an immutable form version snapshot into the atomic repository write', async () => {
    const { service, writes } = createHarness();
    const formData = { customerNeed: 'Skin care' };
    await service.createScheduled({ ...baseInput, formData });
    formData.customerNeed = 'Changed after submit';
    expect(writes[0]).toMatchObject({
      formVersionId: ids.version,
      formData: { customerNeed: 'Skin care' },
    });
  });

  it('writes submission, booking, initial history, audit and outbox in one transaction', async () => {
    const writes: string[] = [];
    const scheduledStartAt = new Date('2026-07-25T09:00:00.000Z');
    const transaction = {
      customer: {
        findUnique: async () => ({ id: ids.customer, archivedAt: null }),
      },
      customerBranchAccess: {
        findFirst: async () => ({ customerId: ids.customer, branchId: ids.branch }),
      },
      serviceOfferingVersion: {
        findUnique: async () => ({
          id: '80000000-0000-4000-8000-000000000001',
          serviceOfferingId: ids.service,
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
        }),
      },
      serviceBranchAvailability: {
        findFirst: async () => ({ id: 'availability' }),
      },
      tenantMembership: {
        findUnique: async () => ({ id: ids.membership, status: 'ACTIVE' }),
      },
      assignment: {
        findFirst: async () => ({ membershipId: ids.membership, branchId: ids.branch }),
      },
      formTemplate: {
        findUnique: async () => ({ id: ids.template, status: 'ACTIVE' }),
      },
      formVersion: {
        findUnique: async () => ({
          id: ids.version,
          formTemplateId: ids.template,
          status: 'PUBLISHED',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      formSubmission: {
        create: async () => {
          writes.push('submission');
          return { id: '81000000-0000-4000-8000-000000000001' };
        },
      },
      booking: {
        create: async (input: { data: Record<string, unknown> }) => {
          writes.push('booking');
          return {
            id: '82000000-0000-4000-8000-000000000001',
            ...input.data,
            scheduledStartAt,
          };
        },
      },
      bookingStatusTransition: {
        create: async () => {
          writes.push('history');
        },
      },
      auditEvent: {
        create: async () => {
          writes.push('audit');
        },
      },
      outboxEvent: {
        create: async () => {
          writes.push('outbox');
        },
      },
    };
    const repository = new BookingRepository({
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation(transaction),
    } as never);
    await repository.createScheduledBooking({
      tenantId: ids.tenant,
      branchId: ids.branch,
      customerId: ids.customer,
      serviceOfferingId: ids.service,
      serviceOfferingVersionId: '80000000-0000-4000-8000-000000000001',
      serviceCodeSnapshot: 'FACIAL',
      serviceNameSnapshot: 'Facial',
      assignedMembershipId: ids.membership,
      scheduledStartAt,
      businessDate: new Date('2026-07-25T00:00:00.000Z'),
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      formTemplateId: ids.template,
      formVersionId: ids.version,
      formData: { customerNeed: 'Skin care' },
      actorMembershipId: ids.membership,
      correlationId: 'atomic-booking',
      idempotencyKey: 'atomic-booking-key',
    });
    expect(writes).toEqual(['submission', 'booking', 'history', 'audit', 'outbox']);
  });
});
