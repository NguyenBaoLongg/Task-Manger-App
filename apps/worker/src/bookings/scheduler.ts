export interface BookingSchedulerResult {
  readonly jobType: string;
  readonly processed: number;
}

export interface BookingScheduledRunner {
  run(now: Date): Promise<BookingSchedulerResult[]>;
}

export class BookingScheduler {
  constructor(private readonly runners: readonly BookingScheduledRunner[] = []) {}

  async tick(now = new Date()): Promise<BookingSchedulerResult[]> {
    const results: BookingSchedulerResult[] = [];
    for (const runner of this.runners) results.push(...(await runner.run(now)));
    return results;
  }
}

export class BookingReportSchedulerRunner {
  constructor(
    private readonly repository: BookingWorkerRepository,
    private readonly runner: BookingReportRunner,
  ) {}

  async run(now: Date) {
    const results: Array<{ jobType: string; processed: number }> = [];
    for (const tenantId of await this.repository.listTenantIds()) {
      const timezone = (await this.repository.getTenantTimezone(tenantId)) ?? 'Asia/Ho_Chi_Minh';
      for (const reportType of ['TOMORROW_SCHEDULE', 'TODAY_OUTCOME'] as BookingReportType[]) {
        if (!isBookingReportDue(reportType, now, timezone)) continue;
        const result = await this.runner.run({ tenantId, reportType, now });
        if (result.claimed)
          results.push({ jobType: `BOOKING_REPORT_${reportType}`, processed: result.processed });
      }
    }
    return results;
  }
}

import type { BookingRetentionRunner } from './retention-runner.js';

export class BookingRetentionSchedulerRunner {
  constructor(
    private readonly repository: {
      listTenantIds(): Promise<string[]>;
      ensureRetentionRun(input: {
        tenantId: string;
        businessDate: Date;
        correlationId: string;
      }): Promise<{ id: string }>;
      claimRetentionRun(input: {
        tenantId: string;
        runId: string;
        leaseOwner: string;
        now: Date;
        leaseDurationMs: number;
      }): Promise<unknown>;
      heartbeatReportRun(input: {
        tenantId: string;
        runId: string;
        leaseOwner: string;
        now: Date;
        leaseDurationMs: number;
      }): Promise<unknown>;
      completeRetentionRun(input: {
        tenantId: string;
        runId: string;
        leaseOwner: string;
        now: Date;
      }): Promise<unknown>;
      failRetentionRun(input: {
        tenantId: string;
        runId: string;
        leaseOwner: string;
        code: string;
      }): Promise<unknown>;
    },
    private readonly runner: BookingRetentionRunner,
    private readonly leaseOwner = `booking-retention:${Date.now()}`,
    private readonly leaseDurationMs = 60_000,
  ) {}

  async run(now: Date) {
    const results: Array<{ jobType: string; processed: number }> = [];
    const businessDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    for (const tenantId of await this.repository.listTenantIds()) {
      const run = await this.repository.ensureRetentionRun({
        tenantId,
        businessDate,
        correlationId: `booking-retention:${tenantId}:${businessDate.toISOString().slice(0, 10)}`,
      });
      const claimed = await this.repository.claimRetentionRun({
        tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        now,
        leaseDurationMs: this.leaseDurationMs,
      });
      if (!claimed) continue;
      const heartbeat = setInterval(
        () => {
          void this.repository.heartbeatReportRun({
            tenantId,
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
        const result = await this.runner.runTenant({ tenantId, now });
        if (result.failed > 0) {
          await this.repository.failRetentionRun({
            tenantId,
            runId: run.id,
            leaseOwner: this.leaseOwner,
            code: 'BOOKING_MEDIA_RETENTION_PARTIAL_FAILURE',
          });
          results.push({ jobType: 'BOOKING_MEDIA_RETENTION', processed: result.processed });
          continue;
        }
        await this.repository.completeRetentionRun({
          tenantId,
          runId: run.id,
          leaseOwner: this.leaseOwner,
          now: new Date(),
        });
        results.push({ jobType: 'BOOKING_MEDIA_RETENTION', processed: result.processed });
      } catch (error) {
        await this.repository.failRetentionRun({
          tenantId,
          runId: run.id,
          leaseOwner: this.leaseOwner,
          code: error instanceof Error ? error.name : 'BOOKING_MEDIA_RETENTION_FAILED',
        });
        throw error;
      } finally {
        clearInterval(heartbeat);
      }
    }
    return results;
  }
}

import type { BookingWorkerRepository } from '@adsup/database';
import { isBookingReportDue, type BookingReportType } from '@adsup/domain';
import type { BookingReportRunner } from './report-runner.js';
