import type { MembershipId, TenantId, UUID } from '../foundation.js';

export type AttendanceBranchId = UUID;
export type AttendanceBusinessDate = string;
export type YearMonth = string;
export type MoneyMinor = bigint;
export type Currency = 'VND';

export type ShiftStatus = 'ACTIVE' | 'RETIRED';
export type ScheduleState = 'SCHEDULED' | 'OFF' | 'LEAVE_APPROVED' | 'ADJUSTED' | 'CANCELLED';
export type ScheduleChangeKind =
  'SELF_EDIT' | 'CHANGE_REQUEST' | 'MANAGER_ADJUSTMENT' | 'OFF_CALENDAR' | 'LEAVE_APPROVAL';
export type AttendanceState =
  | 'PENDING_VIDEO'
  | 'VIDEO_UPLOADED'
  | 'CONFIRMED'
  | 'MISSING_CHECK_IN'
  | 'NON_WORKED'
  | 'EXEMPT_OFF';
export type DayWorkClassification =
  'WORKED_ON_TIME' | 'WORKED_LATE' | 'NON_WORKED_NO_CHECKIN' | 'OFF_OR_APPROVED_LEAVE';
export type ViolationKind =
  | 'MISSING_CHECK_IN'
  | 'VIDEO_STANDARD_FAILED'
  | 'LATE_BASE'
  | 'LATE_NO_NOTICE'
  | 'SUDDEN_LEAVE_NO_NOTICE'
  | 'SUDDEN_LEAVE_OVER_LIMIT'
  | 'LEAVE_RULE_VIOLATION';
export type PenaltySettlementStatus =
  'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'WAIVED' | 'REFUNDED';
export type LeaveDurationKind = 'FULL_DAY' | 'MORNING_HALF' | 'DATE_RANGE';

export interface TenantScopedMemberDay {
  tenantId: TenantId;
  membershipId: MembershipId;
  branchId: AttendanceBranchId;
  businessDate: AttendanceBusinessDate;
}

export interface ShiftSnapshot {
  id: UUID;
  code: string;
  startLocalTime: string;
  timezone: string;
  versionNumber: number;
}

export interface PolicyMoneySnapshot {
  policyVersionId: UUID;
  amountMinor: MoneyMinor;
  currency: Currency;
}

export interface AttendanceKpiSourceSnapshot {
  tenantId: TenantId;
  membershipId: MembershipId;
  branchId: AttendanceBranchId;
  businessDate: AttendanceBusinessDate;
  value: '100' | '0' | null;
  observedAt: Date | null;
  sourceAttendanceEventId?: UUID;
}
