export type CalendarFilters = { businessDate: string; branchId?: string };
export const normalizeCalendarFilters = (filters: CalendarFilters) => ({
  businessDate: filters.businessDate,
  branchId: filters.branchId,
});
export type BookingRow = {
  id: string;
  branchId?: string;
  scheduledStartAt?: string;
  status: string;
  customerName?: string;
};
export const normalizeBooking = (value: unknown): BookingRow | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return undefined;
  return {
    id: row.id,
    branchId: typeof row.branchId === 'string' ? row.branchId : undefined,
    scheduledStartAt: typeof row.scheduledStartAt === 'string' ? row.scheduledStartAt : undefined,
    status: typeof row.status === 'string' ? row.status : 'SCHEDULED',
    customerName: typeof row.customerName === 'string' ? row.customerName : undefined,
  };
};
export const formatBookingTime = (value?: string) =>
  value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Walk-in';
