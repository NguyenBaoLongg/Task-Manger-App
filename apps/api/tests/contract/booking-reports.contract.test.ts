import { describe, expect, it } from 'vitest';
import {
  bookingJobRunSchema,
  bookingReportReadyEventSchema,
  bookingReportDestinationSchema,
  replaceBookingReportDestinationsSchema,
  rerunBookingReportSchema,
} from '@adsup/contracts';
import { readFileSync } from 'node:fs';

const openapi = readFileSync('specs/004-booking-export/contracts/openapi.yaml', 'utf8');

describe('booking report contracts', () => {
  it('publishes destination and rerun operations with permissions', () => {
    expect(openapi).toContain('operationId: listBookingReportDestinations');
    expect(openapi).toContain('operationId: replaceBookingReportDestinations');
    expect(openapi).toContain('operationId: rerunBookingReport');
    expect(openapi).toContain('x-permission: booking.config.manage');
    expect(openapi).toContain('x-permission: booking.report.rerun');
  });

  it('validates scoped destinations, rerun reasons and job responses', () => {
    const branchId = '10000000-0000-4000-8000-000000000001';
    const channelId = '10000000-0000-4000-8000-000000000002';
    expect(
      replaceBookingReportDestinationsSchema.parse({
        items: [{ branchId, reportType: 'TODAY_OUTCOME', chatChannelId: channelId }],
      }).items,
    ).toHaveLength(1);
    expect(() => rerunBookingReportSchema.parse({ reportType: 'TODAY_OUTCOME' })).toThrow();
    expect(
      rerunBookingReportSchema.parse({
        reportType: 'TODAY_OUTCOME',
        businessDate: '2031-01-15',
        reason: 'Retry failed delivery',
      }).reason,
    ).toBe('Retry failed delivery');
    expect(
      bookingReportDestinationSchema.parse({
        id: channelId,
        branchId,
        reportType: 'TODAY_OUTCOME',
        chatChannelId: channelId,
        effectiveFrom: '2031-01-01T00:00:00.000Z',
      }).status,
    ).toBe('ACTIVE');
    expect(
      bookingJobRunSchema.parse({
        id: channelId,
        jobType: 'BOOKING_REPORT_TODAY_OUTCOME',
        businessDate: '2031-01-15',
        state: 'PENDING',
        attempt: 0,
      }).state,
    ).toBe('PENDING');
    expect(
      bookingReportReadyEventSchema.parse({
        eventId: '10000000-0000-4000-8000-000000000003',
        eventType: 'booking.report-ready.v1',
        schemaVersion: 1,
        tenantId: '10000000-0000-4000-8000-000000000004',
        branchId: null,
        aggregateType: 'BOOKING',
        aggregateId: channelId,
        occurredAt: '2031-01-15T15:00:00.000Z',
        correlationId: 'report-ready',
        actorMembershipId: null,
        payload: {
          reportRunId: channelId,
          reportType: 'TODAY_OUTCOME',
          businessDate: '2031-01-15',
          branchScope: [branchId],
          contentHash: 'a'.repeat(64),
          destinationCount: 1,
        },
      }).eventType,
    ).toBe('booking.report-ready.v1');
  });
});
