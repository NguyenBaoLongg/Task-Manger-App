export type BookingType = 'SCHEDULED' | 'WALK_IN';
export type BookingStatus = 'SCHEDULED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED';
export type BookingReportType = 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';

export interface BookingWindow {
  readonly type: BookingType;
  readonly status: BookingStatus;
  readonly startsAt: Date;
}

export interface BookingScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly assignedMembershipId: string;
}
