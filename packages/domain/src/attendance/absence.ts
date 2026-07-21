import { ProblemError } from '../foundation.js';
import type { LeaveDurationKind, ViolationKind } from './types.js';

export interface LeaveRangeInput {
  durationKind: LeaveDurationKind;
  startDate: string;
  endDate: string;
}

export interface OffCalendarCandidate {
  id: string;
  scopeType: 'TENANT' | 'BRANCH';
  branchId?: string | null;
  startDate: string;
  endDate: string;
}

export function expandLeaveDates(input: LeaveRangeInput): string[] {
  const start = parseBusinessDate(input.startDate);
  const end = parseBusinessDate(input.endDate);
  if (end < start) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Khoang ngay nghi khong hop le.');
  }
  if (input.durationKind === 'MORNING_HALF' && input.startDate !== input.endDate) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Nghi buoi sang chi ap dung cho mot ngay.');
  }
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    dates.push(formatBusinessDate(cursor));
  }
  return dates;
}

export function countAbsenceDays(inputs: LeaveRangeInput[]): number {
  return inputs.reduce(
    (total, input) =>
      total + expandLeaveDates(input).length * (input.durationKind === 'MORNING_HALF' ? 0.5 : 1),
    0,
  );
}

export function resolveOffCalendar(input: {
  calendars: OffCalendarCandidate[];
  branchId: string;
  businessDate: string;
}) {
  const matched = input.calendars.find(
    (calendar) =>
      calendar.startDate <= input.businessDate &&
      calendar.endDate >= input.businessDate &&
      (calendar.scopeType === 'TENANT' || calendar.branchId === input.branchId),
  );
  return matched
    ? { applies: true as const, calendarId: matched.id, scopeType: matched.scopeType }
    : { applies: false as const };
}

export function evaluateConsecutiveLeaveRule(input: {
  requestedDates: string[];
  existingLeaveDates: string[];
  hasApprovedException: boolean;
}): { allowed: true } | { allowed: false; violationKind: 'CONSECUTIVE_DAYS' } {
  if (input.hasApprovedException) return { allowed: true };
  const all = Array.from(new Set([...input.requestedDates, ...input.existingLeaveDates])).sort();
  for (let index = 1; index < all.length; index += 1) {
    if (daysBetween(all[index - 1]!, all[index]!) === 1) {
      return { allowed: false, violationKind: 'CONSECUTIVE_DAYS' };
    }
  }
  return { allowed: true };
}

export interface LeaveConflictCandidate {
  requestId: string;
  membershipId: string;
  branchId: string;
  departmentId?: string | null;
  positionId?: string | null;
  dates: string[];
}

export function findLeaveConflict(input: {
  request: Omit<LeaveConflictCandidate, 'requestId'>;
  existing: LeaveConflictCandidate[];
}):
  | {
      result: 'CONFLICT';
      conflictingRequestId: string;
      conflictingMembershipId: string;
      businessDate: string;
    }
  | { result: 'CLEAR' } {
  for (const candidate of input.existing) {
    if (candidate.membershipId === input.request.membershipId) continue;
    if (candidate.branchId !== input.request.branchId) continue;
    const sameDepartment =
      input.request.departmentId && candidate.departmentId === input.request.departmentId;
    const samePosition =
      input.request.positionId && candidate.positionId === input.request.positionId;
    if (!sameDepartment && !samePosition) continue;
    const overlapping = candidate.dates.find((date) => input.request.dates.includes(date));
    if (overlapping) {
      return {
        result: 'CONFLICT',
        conflictingRequestId: candidate.requestId,
        conflictingMembershipId: candidate.membershipId,
        businessDate: overlapping,
      };
    }
  }
  return { result: 'CLEAR' };
}

export function violationForConsecutiveLeave(): ViolationKind {
  return 'LEAVE_RULE_VIOLATION';
}

export function formatBusinessDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseBusinessDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(left: string, right: string): number {
  const ms = parseBusinessDate(right).getTime() - parseBusinessDate(left).getTime();
  return Math.round(ms / 86_400_000);
}
