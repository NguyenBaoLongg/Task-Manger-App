import type { AttendanceWorkerRepository } from '@adsup/database';
import type { AttendanceDayCloseRunner } from './day-close-runner.js';
import type { MonthlyAbsenceRunner } from './monthly-absence-runner.js';
import type { VideoConversionRunner } from './video-conversion-runner.js';

export interface AttendanceSchedulerResult {
  readonly jobType: string;
  readonly processed: number;
}

export class AttendanceScheduler {
  constructor(
    private readonly repository?: AttendanceWorkerRepository,
    private readonly videoConversion?: VideoConversionRunner,
    private readonly dayClose?: AttendanceDayCloseRunner,
    private readonly monthlyAbsence?: MonthlyAbsenceRunner,
  ) {}

  async tick(): Promise<AttendanceSchedulerResult[]> {
    this.repository?.getClient();
    const results: AttendanceSchedulerResult[] = [];
    if (this.videoConversion) {
      const converted = await this.videoConversion.runTenant('');
      results.push({ jobType: 'ATTENDANCE_VIDEO_CONVERSION', processed: converted.processed });
    }
    if (this.dayClose) {
      const closed = await this.dayClose.runTenantDay();
      results.push({ jobType: 'ATTENDANCE_DAY_CLOSE', processed: closed.processed });
    }
    if (this.monthlyAbsence) {
      const summarized = await this.monthlyAbsence.runTenantMonth({
        tenantId: '',
        yearMonth: new Date().toISOString().slice(0, 7),
      });
      results.push({ jobType: 'ATTENDANCE_MONTHLY_ABSENCE', processed: summarized.processed });
    }
    return results;
  }
}
