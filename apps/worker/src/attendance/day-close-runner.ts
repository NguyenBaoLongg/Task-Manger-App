import type { AttendanceRepository } from '@adsup/database';

export class AttendanceDayCloseRunner {
  constructor(private readonly repository?: AttendanceRepository) {}

  async runTenantDay(input?: { tenantId: string; branchId: string; businessDate: Date }) {
    if (input && this.repository) {
      const offCalendar = await this.repository.isOffCalendarDay(input);
      if (offCalendar) {
        return { processed: 0, missingCheckIns: 0, nonWorked: 0, suppressedByOffCalendar: 1 };
      }
    }
    return { processed: 0, missingCheckIns: 0, nonWorked: 0, suppressedByOffCalendar: 0 };
  }
}
