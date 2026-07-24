import { describe, expect, it } from 'vitest';
import {
  bookingEventEnvelopeSchema,
  createCustomerPhotoConsentSchema,
  createCustomerSchema,
  createExportSchema,
  createScheduledBookingSchema,
} from './booking.js';

const id = '10000000-0000-4000-8000-000000000001';

describe('Module 4 Zod contracts', () => {
  it('rejects unknown fields and invalid cross-boundary payload shapes', () => {
    expect(() =>
      createCustomerSchema.parse({ displayName: 'An', branchIds: [id], tenantId: id }),
    ).toThrow();
    expect(() =>
      createScheduledBookingSchema.parse({
        branchId: id,
        customerId: id,
        serviceOfferingId: id,
        assignedMembershipId: id,
        scheduledStartAt: 'not-a-time',
        formTemplateId: id,
        formVersionId: id,
        formData: {},
      }),
    ).toThrow();
  });

  it('requires an effective consent policy before customer-photo upload', () => {
    expect(() =>
      createCustomerPhotoConsentSchema.parse({ method: 'VERBAL', policyVersionId: id }),
    ).not.toThrow();
    expect(() => createCustomerPhotoConsentSchema.parse({ method: 'VERBAL' })).toThrow();
  });

  it('only accepts bounded XLSX exports', () => {
    expect(() =>
      createExportSchema.parse({
        format: 'XLSX',
        dataTypes: ['BOOKINGS'],
        dateFrom: '2026-07-01',
        dateTo: '2026-07-24',
        branchIds: [id],
      }),
    ).not.toThrow();
    expect(() =>
      createExportSchema.parse({
        format: 'PDF',
        dataTypes: ['BOOKINGS'],
        dateFrom: '2026-07-01',
        dateTo: '2026-07-24',
        branchIds: [id],
      }),
    ).toThrow();
  });

  it('validates a privacy-safe versioned outbox envelope', () => {
    const event = bookingEventEnvelopeSchema.parse({
      eventId: id,
      eventType: 'booking.created.v1',
      schemaVersion: 1,
      tenantId: id,
      branchId: id,
      aggregateType: 'BOOKING',
      aggregateId: id,
      occurredAt: '2026-07-24T03:00:00.000Z',
      correlationId: 'booking-contract-test',
      actorMembershipId: id,
      payload: { bookingId: id },
    });
    expect(event.payload).not.toHaveProperty('customerPhone');
  });
});
