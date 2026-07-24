import { randomUUID } from 'node:crypto';
import type { AttendanceWorkerRepository } from '@adsup/database';
import type { AttendanceDayCloseRunner } from './day-close-runner.js';
import type { MonthlyAbsenceRunner } from './monthly-absence-runner.js';
import type { VideoConversionRunner } from './video-conversion-runner.js';
import type { CheckInReminderRunner } from './check-in-reminder-runner.js';
import type { MediaRetentionRunner } from './media-retention-runner.js';

function localBusinessDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

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
    private readonly checkInReminder?: CheckInReminderRunner,
    private readonly mediaRetention?: MediaRetentionRunner,
    private readonly leaseOwner = `attendance-scheduler:${randomUUID()}`,
    private readonly leaseDurationMs = 60_000,
  ) {}

  async tick(input?: {
    tenantId?: string;
    businessDate?: string;
    timezone?: string;
    now?: Date;
  }): Promise<AttendanceSchedulerResult[]> {
    const results: AttendanceSchedulerResult[] = [];
    const now = input?.now ?? new Date();
    const tenants = input?.tenantId
      ? [{ id: input.tenantId, timezone: input.timezone ?? 'Asia/Ho_Chi_Minh' }]
      : this.repository
        ? await this.repository.listActiveTenantsForAttendance()
        : [];
    for (const tenant of tenants) {
      const businessDate = input?.businessDate ?? localBusinessDate(now, tenant.timezone);
      const businessDateDate = new Date(`${businessDate}T00:00:00.000Z`);
      const yearMonth = businessDate.slice(0, 7);
      if (this.checkInReminder) {
        const reminded = await this.runDayJob({
          tenantId: tenant.id,
          jobType: 'ATTENDANCE_CHECKIN_REMINDER',
          businessDate: businessDateDate,
          now,
          execute: () =>
            this.checkInReminder!.runTenant({
              tenantId: tenant.id,
              businessDate,
              timezone: tenant.timezone,
              now,
            }),
        });
        if (reminded) {
          results.push({ jobType: 'ATTENDANCE_CHECKIN_REMINDER', processed: reminded.processed });
        }
      }
      if (this.videoConversion) {
        const converted = await this.runDayJob({
          tenantId: tenant.id,
          jobType: 'ATTENDANCE_VIDEO_CONVERSION',
          businessDate: businessDateDate,
          now,
          execute: () => this.videoConversion!.runTenant(tenant.id),
        });
        if (converted) {
          results.push({ jobType: 'ATTENDANCE_VIDEO_CONVERSION', processed: converted.processed });
        }
      }
      if (this.dayClose) {
        const closed = await this.runDayJob({
          tenantId: tenant.id,
          jobType: 'ATTENDANCE_DAY_CLOSE',
          businessDate: businessDateDate,
          now,
          execute: () =>
            this.dayClose!.runTenantDay({
              tenantId: tenant.id,
              businessDate: businessDateDate,
              timezone: tenant.timezone,
              now,
            }),
        });
        if (closed) results.push({ jobType: 'ATTENDANCE_DAY_CLOSE', processed: closed.processed });
      }
      if (this.monthlyAbsence) {
        const summarized = await this.runMonthJob({
          tenantId: tenant.id,
          jobType: 'ATTENDANCE_MONTHLY_ABSENCE',
          yearMonth,
          now,
          execute: () =>
            this.monthlyAbsence!.runTenantMonth({
              tenantId: tenant.id,
              yearMonth,
              correlationId: `attendance-monthly-absence:${tenant.id}:${yearMonth}`,
            }),
        });
        if (summarized) {
          results.push({ jobType: 'ATTENDANCE_MONTHLY_ABSENCE', processed: summarized.processed });
        }
      }
      if (this.mediaRetention) {
        const retained = await this.runDayJob({
          tenantId: tenant.id,
          jobType: 'ATTENDANCE_MEDIA_RETENTION',
          businessDate: businessDateDate,
          now,
          execute: () => this.mediaRetention!.runTenant({ tenantId: tenant.id, now }),
        });
        if (retained) {
          results.push({ jobType: 'ATTENDANCE_MEDIA_RETENTION', processed: retained.processed });
        }
      }
    }
    return results;
  }

  private async runDayJob<T extends { processed: number }>(input: {
    tenantId: string;
    jobType: string;
    businessDate: Date;
    now: Date;
    execute: () => Promise<T>;
  }) {
    if (!this.repository) return null;
    const run = await this.repository.claimDayRun({
      tenantId: input.tenantId,
      jobType: input.jobType,
      businessDate: input.businessDate,
      correlationId: `${input.jobType.toLowerCase()}:${input.tenantId}:${input.businessDate.toISOString().slice(0, 10)}`,
      leaseOwner: this.leaseOwner,
      now: input.now,
      leaseDurationMs: this.leaseDurationMs,
    });
    if (!run) return null;
    const heartbeat = setInterval(
      () => {
        void this.repository?.heartbeatRun({
          tenantId: input.tenantId,
          runId: run.id,
          leaseOwner: this.leaseOwner,
          now: new Date(),
          leaseDurationMs: this.leaseDurationMs,
        });
      },
      Math.max(1_000, Math.floor(this.leaseDurationMs / 2)),
    );
    heartbeat.unref();
    try {
      const result = await input.execute();
      await this.repository.completeRun({
        tenantId: input.tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        now: new Date(),
        checkpointCursor: `processed:${result.processed}`,
      });
      return result;
    } catch (error) {
      await this.repository.failRun({
        tenantId: input.tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        now: new Date(),
        safeErrorCode: `${input.jobType}_FAILED`,
      });
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async runMonthJob<T extends { processed: number }>(input: {
    tenantId: string;
    jobType: string;
    yearMonth: string;
    now: Date;
    execute: () => Promise<T>;
  }) {
    if (!this.repository) return null;
    const run = await this.repository.claimMonthRun({
      tenantId: input.tenantId,
      jobType: input.jobType,
      yearMonth: input.yearMonth,
      correlationId: `${input.jobType.toLowerCase()}:${input.tenantId}:${input.yearMonth}`,
      leaseOwner: this.leaseOwner,
      now: input.now,
      leaseDurationMs: this.leaseDurationMs,
    });
    if (!run) return null;
    const heartbeat = setInterval(
      () => {
        void this.repository?.heartbeatRun({
          tenantId: input.tenantId,
          runId: run.id,
          leaseOwner: this.leaseOwner,
          now: new Date(),
          leaseDurationMs: this.leaseDurationMs,
        });
      },
      Math.max(1_000, Math.floor(this.leaseDurationMs / 2)),
    );
    heartbeat.unref();
    try {
      const result = await input.execute();
      await this.repository.completeRun({
        tenantId: input.tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        now: new Date(),
        checkpointCursor: `processed:${result.processed}`,
      });
      return result;
    } catch (error) {
      await this.repository.failRun({
        tenantId: input.tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        now: new Date(),
        safeErrorCode: `${input.jobType}_FAILED`,
      });
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }
}
