import { describe, expect, it } from 'vitest';
import {
  createCustomerSchema,
  createScheduledBookingSchema,
  loadBookingOpenApiDocument,
} from '@adsup/contracts';

const id = '10000000-0000-4000-8000-000000000001';

describe('booking create contract', () => {
  it('publishes customer, service catalog and scheduled booking operations', async () => {
    const document = await loadBookingOpenApiDocument();
    const paths = document.paths as Record<string, unknown>;
    expect(paths).toHaveProperty('/v1/tenants/{tenantId}/customers');
    expect(paths).toHaveProperty('/v1/tenants/{tenantId}/booking-services');
    expect(paths).toHaveProperty('/v1/tenants/{tenantId}/bookings');
  });

  it('accepts authoritative IDs and rejects client-owned tenant/actor fields', () => {
    expect(
      createCustomerSchema.safeParse({ displayName: 'Khách A', branchIds: [id] }).success,
    ).toBe(true);
    expect(
      createScheduledBookingSchema.safeParse({
        branchId: id,
        customerId: id,
        serviceOfferingId: id,
        assignedMembershipId: id,
        scheduledStartAt: '2026-07-25T02:00:00.000Z',
        formTemplateId: id,
        formVersionId: id,
        formData: { customerNeed: 'Chăm sóc da' },
        tenantId: id,
      }).success,
    ).toBe(false);
  });
});
