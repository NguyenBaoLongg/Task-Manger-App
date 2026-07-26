import { describe, expect, it } from 'vitest';
import { aggregateBookingReport, getBookingReportWindow, renderBookingReport } from './report.js';

describe('booking report windows and aggregation', () => {
  it('uses tenant-local dates for the 20:08 tomorrow snapshot and 22:00 outcome snapshot', () => {
    const now = new Date('2031-01-15T13:08:00.000Z');
    expect(getBookingReportWindow('TOMORROW_SCHEDULE', now, 'Asia/Ho_Chi_Minh')).toMatchObject({
      businessDate: '2031-01-16',
      dueLocalTime: '20:08',
    });
    expect(
      getBookingReportWindow(
        'TODAY_OUTCOME',
        new Date('2031-01-15T15:00:00.000Z'),
        'Asia/Ho_Chi_Minh',
      ),
    ).toMatchObject({
      businessDate: '2031-01-15',
      dueLocalTime: '22:00',
    });
  });

  it('keeps DST and branch/staff grouping deterministic', () => {
    const window = getBookingReportWindow(
      'TODAY_OUTCOME',
      new Date('2031-03-09T17:00:00.000Z'),
      'America/New_York',
    );
    const snapshot = aggregateBookingReport({
      reportType: 'TODAY_OUTCOME',
      businessDate: window.businessDate,
      branchIds: ['branch-a'],
      bookings: [
        {
          id: 'booking-1',
          branchId: 'branch-a',
          branchName: 'A',
          assignedMembershipId: 'member-1',
          assignedDisplayName: 'An',
          customerDisplayName: 'Customer A',
          scheduledStartAt: '2031-03-09T14:00:00.000Z',
          status: 'ARRIVED',
          reasonCode: null,
          reasonLabel: null,
          tourCompleted: true,
          photoDebtOpen: false,
        },
        {
          id: 'booking-2',
          branchId: 'branch-a',
          branchName: 'A',
          assignedMembershipId: 'member-1',
          assignedDisplayName: 'An',
          customerDisplayName: 'Customer B',
          scheduledStartAt: '2031-03-09T15:00:00.000Z',
          status: 'CANCELLED',
          reasonCode: 'CLIENT_REQUEST',
          reasonLabel: 'Client request',
          tourCompleted: false,
          photoDebtOpen: false,
        },
      ],
    });
    expect(snapshot.totals).toMatchObject({
      total: 2,
      arrived: 1,
      cancelled: 1,
      toursCompleted: 1,
    });
    expect(snapshot.reasonGroups).toEqual([
      { code: 'CLIENT_REQUEST', label: 'Client request', count: 1 },
    ]);
    expect(snapshot.groups).toEqual([
      expect.objectContaining({ branchId: 'branch-a', assignedMembershipId: 'member-1', count: 2 }),
    ]);
    expect(renderBookingReport(snapshot)).toContain('CLIENT_REQUEST');
  });
});
