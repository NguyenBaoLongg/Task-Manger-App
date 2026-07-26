import { describe, expect, it } from 'vitest';
import {
  cancellationReasonVersionSchema,
  createCancellationReasonSchema,
  recordBookingOutcomeSchema,
  rescheduleBookingSchema,
} from '@adsup/contracts';
import { readFileSync } from 'node:fs';

const openapi = readFileSync('specs/004-booking-export/contracts/openapi.yaml', 'utf8');

describe('booking outcome contracts', () => {
  it('keeps the published US3 operations and permissions', () => {
    expect(openapi).toContain('operationId: listBookingCancellationReasons');
    expect(openapi).toContain('operationId: createBookingCancellationReasonVersion');
    expect(openapi).toContain('operationId: recordBookingOutcome');
    expect(openapi).toContain('operationId: rescheduleBooking');
    expect(openapi).toContain('x-permission: booking.config.manage');
    expect(openapi).toContain('x-permission: booking.outcome.manage');
    expect(openapi).toContain('x-permission: booking.manage');
  });

  it('rejects incomplete reason and command payloads', () => {
    expect(() => createCancellationReasonSchema.parse({ code: 'NO_SHOW' })).toThrow();
    expect(() => recordBookingOutcomeSchema.parse({ outcome: 'NO_SHOW' })).toThrow();
    expect(() => rescheduleBookingSchema.parse({ scheduledStartAt: 'bad' })).toThrow();
  });

  it('accepts versioned reason and command payloads', () => {
    const id = '10000000-0000-4000-8000-000000000001';
    const payload = {
      reasonId: id,
      code: 'CUSTOMER_REQUEST',
      label: 'Customer request',
      appliesToCancellation: true,
      appliesToReschedule: true,
      effectiveFrom: '2026-07-25T09:00:00.000Z',
    };
    expect(createCancellationReasonSchema.parse(payload).code).toBe('CUSTOMER_REQUEST');
    expect(
      cancellationReasonVersionSchema.parse({
        ...payload,
        id,
        versionNumber: 1,
        status: 'ACTIVE',
      }).versionNumber,
    ).toBe(1);
    expect(
      recordBookingOutcomeSchema.parse({
        outcome: 'CANCELLED',
        reasonVersionId: id,
        expectedStateVersion: 1,
      }).outcome,
    ).toBe('CANCELLED');
  });
});
