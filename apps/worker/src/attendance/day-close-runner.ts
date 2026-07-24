import type {
  ActionItemRepository,
  AttendanceRepository,
  PenaltyRepository,
} from '@adsup/database';

export class AttendanceDayCloseRunner {
  constructor(
    private readonly repository?: AttendanceRepository,
    private readonly penalties?: PenaltyRepository,
    private readonly actionItems?: ActionItemRepository,
  ) {}

  async runTenantDay(input?: {
    tenantId: string;
    branchId?: string;
    businessDate: Date;
    timezone?: string;
    now?: Date;
  }) {
    if (!input || !this.repository) {
      return { processed: 0, missingCheckIns: 0, nonWorked: 0, suppressedByOffCalendar: 0 };
    }
    if (input.now && !isAtOrAfterNoon(input.now, input.timezone ?? 'Asia/Ho_Chi_Minh')) {
      return { processed: 0, missingCheckIns: 0, nonWorked: 0, suppressedByOffCalendar: 0 };
    }
    if (input.branchId) {
      const offCalendar = await this.repository.isOffCalendarDay({
        tenantId: input.tenantId,
        branchId: input.branchId,
        businessDate: input.businessDate,
      });
      if (offCalendar) {
        return { processed: 0, missingCheckIns: 0, nonWorked: 0, suppressedByOffCalendar: 1 };
      }
    }
    const candidates = await this.repository.listDayCloseCandidates({
      tenantId: input.tenantId,
      branchId: input.branchId,
      businessDate: input.businessDate,
    });
    let processed = 0;
    let missingCheckIns = 0;
    let nonWorked = 0;
    let suppressedByOffCalendar = 0;
    for (const candidate of candidates) {
      if (
        await this.repository.isOffCalendarDay({
          tenantId: candidate.tenantId,
          branchId: candidate.branchId,
          businessDate: candidate.businessDate,
        })
      ) {
        suppressedByOffCalendar += 1;
        continue;
      }
      const event = await this.repository.createMissingCheckInEvent({
        tenantId: candidate.tenantId,
        membershipId: candidate.membershipId,
        branchId: candidate.branchId,
        businessDate: candidate.businessDate,
        scheduleVersionId: candidate.scheduleVersionId,
        correlationId: `attendance-day-close:${candidate.tenantId}:${dateKey(candidate.businessDate)}`,
      });
      if (!event) continue;
      await this.penalties?.assessMissingCheckInEvent({
        tenantId: event.tenantId,
        attendanceEventId: event.id,
        correlationId: event.correlationId,
      });
      await this.actionItems?.projectAttendanceSource({
        tenantId: event.tenantId,
        ownerMembershipId: event.membershipId,
        branchId: event.branchId,
        sourceType: 'ATTENDANCE_MISSING_CHECKIN',
        sourceId: event.id,
        businessDate: event.businessDate,
        title: 'Chua check-in truoc 12:00',
        deadlineAt: noonDeadline(event.businessDate),
        correlationId: event.correlationId,
      });
      processed += 1;
      missingCheckIns += 1;
      if (event.dayClassification === 'NON_WORKED_NO_CHECKIN') nonWorked += 1;
    }
    return { processed, missingCheckIns, nonWorked, suppressedByOffCalendar };
  }
}

function isAtOrAfterNoon(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return Number(values.hour) > 12 || (Number(values.hour) === 12 && Number(values.minute) >= 0);
}

function noonDeadline(businessDate: Date) {
  return new Date(`${dateKey(businessDate)}T12:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
