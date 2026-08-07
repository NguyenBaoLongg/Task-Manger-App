import {
  formatBookingTime,
  normalizeBooking,
  normalizeCalendarFilters,
} from '@/features/booking/calendar-model';

describe('booking UI models', () => {
  it('normalizes branch/date filters and booking rows without exposing foreign scope', () => {
    expect(normalizeCalendarFilters({ businessDate: '2026-07-26', branchId: 'branch-a' })).toEqual({
      businessDate: '2026-07-26',
      branchId: 'branch-a',
    });
    expect(
      normalizeBooking({
        id: 'b-1',
        tenantId: 'tenant-a',
        branchId: 'branch-a',
        scheduledStartAt: '2026-07-26T10:00:00Z',
      }),
    ).toEqual({
      id: 'b-1',
      branchId: 'branch-a',
      scheduledStartAt: '2026-07-26T10:00:00Z',
      status: 'SCHEDULED',
    });
  });

  it('formats an appointment time for the device locale', () => {
    expect(formatBookingTime('2026-07-26T10:00:00.000Z')).toMatch(/\d{1,2}:\d{2}/);
  });
});
