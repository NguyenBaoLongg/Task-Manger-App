import type { BookingReportType } from './types.js';

export interface BookingReportBooking {
  id: string;
  branchId: string;
  branchName: string;
  assignedMembershipId: string;
  assignedDisplayName: string;
  customerDisplayName: string;
  scheduledStartAt: string;
  status: 'SCHEDULED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED';
  reasonCode: string | null;
  reasonLabel: string | null;
  tourCompleted: boolean;
  photoDebtOpen: boolean;
}

export interface BookingReportWindow {
  reportType: BookingReportType;
  businessDate: string;
  startAt: Date;
  endAt: Date;
  dueLocalTime: '20:08' | '22:00';
}

export interface BookingReportSnapshot {
  reportType: BookingReportType;
  businessDate: string;
  totals: {
    total: number;
    scheduled: number;
    arrived: number;
    noShow: number;
    cancelled: number;
    rescheduled: number;
    toursCompleted: number;
    missingPhotos: number;
  };
  reasonGroups: Array<{ code: string; label: string; count: number }>;
  groups: Array<{
    branchId: string;
    branchName: string;
    assignedMembershipId: string;
    assignedDisplayName: string;
    count: number;
  }>;
  rows: BookingReportBooking[];
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function localDate(date: Date, timezone: string) {
  const parts = localParts(date, timezone);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localDateTimeToUtc(date: string, hour: number, minute: number, timezone: string) {
  const target = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour,
    minute,
  );
  const guess = new Date(target);
  const actual = localParts(guess, timezone);
  const represented = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
  );
  return new Date(target + (target - represented));
}

export function getBookingReportWindow(
  reportType: BookingReportType,
  now: Date,
  timezone: string,
): BookingReportWindow {
  const today = localDate(now, timezone);
  const businessDate = reportType === 'TOMORROW_SCHEDULE' ? addDays(today, 1) : today;
  const endDate = addDays(businessDate, 1);
  return {
    reportType,
    businessDate,
    startAt: localDateTimeToUtc(businessDate, 0, 0, timezone),
    endAt: localDateTimeToUtc(endDate, 0, 0, timezone),
    dueLocalTime: reportType === 'TOMORROW_SCHEDULE' ? '20:08' : '22:00',
  };
}

export function isBookingReportDue(reportType: BookingReportType, now: Date, timezone: string) {
  const parts = localParts(now, timezone);
  const due = reportType === 'TOMORROW_SCHEDULE' ? [20, 8] : [22, 0];
  return parts.hour === due[0] && parts.minute === due[1];
}

export function aggregateBookingReport(input: {
  reportType: BookingReportType;
  businessDate: string;
  branchIds?: string[];
  bookings: BookingReportBooking[];
}): BookingReportSnapshot {
  const allowed = input.branchIds ? new Set(input.branchIds) : null;
  const rows = input.bookings
    .filter((booking) => !allowed || allowed.has(booking.branchId))
    .sort(
      (a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt) || a.id.localeCompare(b.id),
    );
  const totals = {
    total: rows.length,
    scheduled: rows.filter((row) => row.status === 'SCHEDULED').length,
    arrived: rows.filter((row) => row.status === 'ARRIVED').length,
    noShow: rows.filter((row) => row.status === 'NO_SHOW').length,
    cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
    rescheduled: rows.filter((row) => row.status === 'RESCHEDULED').length,
    toursCompleted: rows.filter((row) => row.tourCompleted).length,
    missingPhotos: rows.filter((row) => row.photoDebtOpen).length,
  };
  const reasonMap = new Map<string, { code: string; label: string; count: number }>();
  for (const row of rows) {
    if (!row.reasonCode) continue;
    const key = `${row.reasonCode}:${row.reasonLabel ?? ''}`;
    const current = reasonMap.get(key) ?? {
      code: row.reasonCode,
      label: row.reasonLabel ?? row.reasonCode,
      count: 0,
    };
    current.count += 1;
    reasonMap.set(key, current);
  }
  const groupMap = new Map<string, BookingReportSnapshot['groups'][number]>();
  for (const row of rows) {
    const key = `${row.branchId}:${row.assignedMembershipId}`;
    const current = groupMap.get(key) ?? {
      branchId: row.branchId,
      branchName: row.branchName,
      assignedMembershipId: row.assignedMembershipId,
      assignedDisplayName: row.assignedDisplayName,
      count: 0,
    };
    current.count += 1;
    groupMap.set(key, current);
  }
  return {
    reportType: input.reportType,
    businessDate: input.businessDate,
    totals,
    reasonGroups: [...reasonMap.values()].sort((a, b) => a.code.localeCompare(b.code)),
    groups: [...groupMap.values()].sort(
      (a, b) =>
        a.branchId.localeCompare(b.branchId) ||
        a.assignedMembershipId.localeCompare(b.assignedMembershipId),
    ),
    rows,
  };
}

export function renderBookingReport(snapshot: BookingReportSnapshot) {
  const lines = [
    `Booking report ${snapshot.reportType} ${snapshot.businessDate}`,
    `Total=${snapshot.totals.total} Scheduled=${snapshot.totals.scheduled} Arrived=${snapshot.totals.arrived} NoShow=${snapshot.totals.noShow} Cancelled=${snapshot.totals.cancelled} Rescheduled=${snapshot.totals.rescheduled}`,
    `ToursCompleted=${snapshot.totals.toursCompleted} MissingPhotos=${snapshot.totals.missingPhotos}`,
    ...snapshot.groups.map(
      (group) => `Group ${group.branchName}/${group.assignedDisplayName}: ${group.count}`,
    ),
    ...snapshot.reasonGroups.map(
      (reason) => `Reason ${reason.code} (${reason.label}): ${reason.count}`,
    ),
  ];
  return lines.join('\n');
}
