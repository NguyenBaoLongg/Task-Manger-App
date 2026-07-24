import { describe, expect, it, vi } from 'vitest';
import type { AttendanceWorkerRepository } from '@adsup/database';
import { AttendanceScheduler } from '../../src/attendance/scheduler.js';
import type { CheckInReminderRunner } from '../../src/attendance/check-in-reminder-runner.js';

describe('AttendanceScheduler', () => {
  it('runs check-in reminders for active tenants using each tenant business date', async () => {
    const listActiveTenantsForAttendance = vi.fn(async () => [
      { id: '11111111-1111-4111-8111-111111111111', timezone: 'Asia/Ho_Chi_Minh' },
    ]);
    const runTenant = vi.fn(async () => ({
      processed: 2,
      reminders: 1,
      targetStartLocalTime: '08:30',
    }));
    const repository = {
      listActiveTenantsForAttendance,
      claimDayRun: vi.fn(async () => ({ id: 'run-reminder' })),
      completeRun: vi.fn(async () => true),
      failRun: vi.fn(async () => true),
    } as unknown as AttendanceWorkerRepository;
    const reminder = {
      runTenant,
    } as unknown as CheckInReminderRunner;

    const scheduler = new AttendanceScheduler(
      repository,
      undefined,
      undefined,
      undefined,
      reminder,
    );

    const results = await scheduler.tick({ now: new Date('2026-07-24T01:15:00.000Z') });

    expect(listActiveTenantsForAttendance).toHaveBeenCalledOnce();
    expect(runTenant).toHaveBeenCalledWith({
      tenantId: '11111111-1111-4111-8111-111111111111',
      businessDate: '2026-07-24',
      timezone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-07-24T01:15:00.000Z'),
    });
    expect(results).toEqual([{ jobType: 'ATTENDANCE_CHECKIN_REMINDER', processed: 2 }]);
  });

  it('runs tenant-aware attendance jobs without empty tenant placeholders', async () => {
    const listActiveTenantsForAttendance = vi.fn(async () => [
      { id: 'tenant-1', timezone: 'Asia/Ho_Chi_Minh' },
      { id: 'tenant-2', timezone: 'Asia/Ho_Chi_Minh' },
    ]);
    const repository = {
      listActiveTenantsForAttendance,
      claimDayRun: vi.fn(async (input: { jobType: string }) => ({ id: `run-${input.jobType}` })),
      claimMonthRun: vi.fn(async (input: { jobType: string }) => ({
        id: `run-${input.jobType}`,
      })),
      completeRun: vi.fn(async () => true),
      failRun: vi.fn(async () => true),
    } as unknown as AttendanceWorkerRepository;
    const videoConversion = {
      runTenant: vi.fn(async () => ({ processed: 1, ready: 1, failed: 0 })),
    };
    const dayClose = {
      runTenantDay: vi.fn(async () => ({
        processed: 1,
        missingCheckIns: 1,
        nonWorked: 1,
        suppressedByOffCalendar: 0,
      })),
    };
    const monthlyAbsence = {
      runTenantMonth: vi.fn(async () => ({ processed: 1, notified: 0, overThreshold: 0 })),
    };
    const mediaRetention = {
      runTenant: vi.fn(async () => ({ processed: 1, deleted: 1, skippedLegalHold: 0, failed: 0 })),
    };

    const scheduler = new AttendanceScheduler(
      repository,
      videoConversion as never,
      dayClose as never,
      monthlyAbsence as never,
      undefined,
      mediaRetention as never,
    );

    const results = await scheduler.tick({ now: new Date('2026-07-24T05:00:00.000Z') });

    expect(videoConversion.runTenant).toHaveBeenCalledWith('tenant-1');
    expect(videoConversion.runTenant).toHaveBeenCalledWith('tenant-2');
    expect(dayClose.runTenantDay).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        businessDate: new Date('2026-07-24T00:00:00.000Z'),
      }),
    );
    expect(monthlyAbsence.runTenantMonth).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', yearMonth: '2026-07' }),
    );
    expect(mediaRetention.runTenant).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(results.map((item) => item.jobType)).toContain('ATTENDANCE_MEDIA_RETENTION');
  });

  it('skips a job when another worker owns its active lease', async () => {
    const runTenant = vi.fn(async () => ({ processed: 1, ready: 1, failed: 0 }));
    const repository = {
      listActiveTenantsForAttendance: vi.fn(async () => [
        { id: 'tenant-1', timezone: 'Asia/Ho_Chi_Minh' },
      ]),
      claimDayRun: vi.fn(async () => null),
      completeRun: vi.fn(async () => true),
      failRun: vi.fn(async () => true),
    } as unknown as AttendanceWorkerRepository;
    const scheduler = new AttendanceScheduler(
      repository,
      { runTenant } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      'worker-2',
    );

    await expect(scheduler.tick({ now: new Date('2026-07-24T05:00:00.000Z') })).resolves.toEqual(
      [],
    );
    expect(runTenant).not.toHaveBeenCalled();
  });

  it('marks the claimed run failed and rethrows a safe worker error', async () => {
    const failure = new Error('storage credential detail');
    const failRun = vi.fn(async () => true);
    const repository = {
      listActiveTenantsForAttendance: vi.fn(async () => [
        { id: 'tenant-1', timezone: 'Asia/Ho_Chi_Minh' },
      ]),
      claimDayRun: vi.fn(async () => ({ id: 'run-video' })),
      completeRun: vi.fn(async () => true),
      failRun,
    } as unknown as AttendanceWorkerRepository;
    const scheduler = new AttendanceScheduler(
      repository,
      {
        runTenant: vi.fn(async () => {
          throw failure;
        }),
      } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      'worker-1',
    );

    await expect(scheduler.tick({ now: new Date('2026-07-24T05:00:00.000Z') })).rejects.toBe(
      failure,
    );
    expect(failRun).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        runId: 'run-video',
        leaseOwner: 'worker-1',
        safeErrorCode: 'ATTENDANCE_VIDEO_CONVERSION_FAILED',
      }),
    );
    expect(JSON.stringify(failRun.mock.calls)).not.toContain('storage credential detail');
  });
});
