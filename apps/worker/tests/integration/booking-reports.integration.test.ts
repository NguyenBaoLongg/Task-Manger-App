import { describe, expect, it, vi } from 'vitest';
import { aggregateBookingReport, getBookingReportWindow } from '@adsup/domain';
import { BookingReportSchedulerRunner } from '../../src/bookings/scheduler.js';

describe('booking report snapshots', () => {
  it('groups tomorrow schedule by branch and assigned staff without cross-scope rows', () => {
    const window = getBookingReportWindow(
      'TOMORROW_SCHEDULE',
      new Date('2031-01-15T13:08:00Z'),
      'Asia/Ho_Chi_Minh',
    );
    const report = aggregateBookingReport({
      reportType: 'TOMORROW_SCHEDULE',
      businessDate: window.businessDate,
      branchIds: ['branch-a'],
      bookings: [
        {
          id: 'booking-a',
          branchId: 'branch-a',
          branchName: 'A',
          assignedMembershipId: 'member-a',
          assignedDisplayName: 'An',
          customerDisplayName: 'A customer',
          scheduledStartAt: '2031-01-16T01:00:00Z',
          status: 'SCHEDULED',
          reasonCode: null,
          reasonLabel: null,
          tourCompleted: false,
          photoDebtOpen: false,
        },
        {
          id: 'booking-b',
          branchId: 'branch-b',
          branchName: 'B',
          assignedMembershipId: 'member-b',
          assignedDisplayName: 'Bình',
          customerDisplayName: 'B customer',
          scheduledStartAt: '2031-01-16T01:00:00Z',
          status: 'SCHEDULED',
          reasonCode: null,
          reasonLabel: null,
          tourCompleted: false,
          photoDebtOpen: false,
        },
      ],
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.branchId).toBe('branch-a');
    expect(report.totals.total).toBe(1);
  });

  it('runs only the tenant-local report whose 20:08/22:00 window is due', async () => {
    const runner = { run: vi.fn().mockResolvedValue({ claimed: true, processed: 1 }) };
    const scheduler = new BookingReportSchedulerRunner(
      {
        listTenantIds: vi.fn().mockResolvedValue(['tenant-a']),
        getTenantTimezone: vi.fn().mockResolvedValue('Asia/Ho_Chi_Minh'),
      } as never,
      runner as never,
    );
    await expect(scheduler.run(new Date('2031-01-15T13:08:00Z'))).resolves.toEqual([
      { jobType: 'BOOKING_REPORT_TOMORROW_SCHEDULE', processed: 1 },
    ]);
    expect(runner.run).toHaveBeenCalledOnce();
  });
});
