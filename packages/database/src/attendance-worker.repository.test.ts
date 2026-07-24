import { describe, expect, it } from 'vitest';
import { AttendanceWorkerRepository } from './attendance-worker.repository.js';

describe('AttendanceWorkerRepository leases', () => {
  it('excludes concurrent owners, reclaims an expired lease and protects completion ownership', async () => {
    const run = {
      tenantId: 'tenant-1',
      id: 'run-1',
      jobType: 'ATTENDANCE_DAY_CLOSE',
      businessDate: new Date('2026-07-24T00:00:00.000Z'),
      yearMonth: null,
      status: 'PENDING',
      checkpointCursor: null as string | null,
      leaseOwner: null as string | null,
      leaseUntil: null as Date | null,
      attempt: 0,
      safeErrorCode: null as string | null,
      safeErrorMessage: null as string | null,
      correlationId: 'day-close',
      startedAt: null as Date | null,
      completedAt: null as Date | null,
    };
    const database = {
      attendanceJobRun: {
        upsert: async () => ({ ...run }),
        findUniqueOrThrow: async () => ({ ...run }),
        updateMany: async (input: {
          where: {
            status?: string;
            leaseOwner?: string;
            leaseUntil?: { gt?: Date };
            OR?: Array<{ status?: { not: string }; leaseUntil?: null | { lte: Date } }>;
          };
          data: Partial<typeof run> & { attempt?: { increment: number } };
        }) => {
          let allowed = true;
          if (input.where.OR) {
            const expiry = input.where.OR.find(
              (condition) =>
                condition.leaseUntil &&
                typeof condition.leaseUntil === 'object' &&
                'lte' in condition.leaseUntil,
            )?.leaseUntil;
            const expired =
              expiry && typeof expiry === 'object' && 'lte' in expiry
                ? run.leaseUntil !== null && run.leaseUntil <= expiry.lte
                : false;
            allowed = run.status !== 'RUNNING' || run.leaseUntil === null || expired;
          } else {
            allowed =
              run.status === input.where.status &&
              run.leaseOwner === input.where.leaseOwner &&
              (input.where.leaseUntil?.gt === undefined ||
                (run.leaseUntil !== null && run.leaseUntil > input.where.leaseUntil.gt));
          }
          if (!allowed) return { count: 0 };
          const increment = input.data.attempt?.increment ?? 0;
          Object.assign(run, input.data, { attempt: run.attempt + increment });
          return { count: 1 };
        },
      },
    };
    const repository = new AttendanceWorkerRepository(database as never);
    const startedAt = new Date('2026-07-24T05:00:00.000Z');

    await expect(
      repository.claimDayRun({
        tenantId: 'tenant-1',
        jobType: 'ATTENDANCE_DAY_CLOSE',
        businessDate: run.businessDate,
        correlationId: 'day-close',
        leaseOwner: 'worker-1',
        now: startedAt,
        leaseDurationMs: 60_000,
      }),
    ).resolves.toMatchObject({ leaseOwner: 'worker-1', status: 'RUNNING', attempt: 1 });

    await expect(
      repository.claimDayRun({
        tenantId: 'tenant-1',
        jobType: 'ATTENDANCE_DAY_CLOSE',
        businessDate: run.businessDate,
        correlationId: 'day-close',
        leaseOwner: 'worker-2',
        now: new Date('2026-07-24T05:00:30.000Z'),
        leaseDurationMs: 60_000,
      }),
    ).resolves.toBeNull();

    await expect(
      repository.claimDayRun({
        tenantId: 'tenant-1',
        jobType: 'ATTENDANCE_DAY_CLOSE',
        businessDate: run.businessDate,
        correlationId: 'day-close',
        leaseOwner: 'worker-2',
        now: new Date('2026-07-24T05:01:01.000Z'),
        leaseDurationMs: 60_000,
      }),
    ).resolves.toMatchObject({ leaseOwner: 'worker-2', status: 'RUNNING', attempt: 2 });

    await expect(
      repository.completeRun({
        tenantId: 'tenant-1',
        runId: 'run-1',
        leaseOwner: 'worker-1',
        now: new Date('2026-07-24T05:01:02.000Z'),
      }),
    ).resolves.toBe(false);
    await expect(
      repository.heartbeatRun({
        tenantId: 'tenant-1',
        runId: 'run-1',
        leaseOwner: 'worker-2',
        now: new Date('2026-07-24T05:01:02.000Z'),
        checkpointCursor: 'page-2',
      }),
    ).resolves.toBe(true);
    expect(run.checkpointCursor).toBe('page-2');
    await expect(
      repository.completeRun({
        tenantId: 'tenant-1',
        runId: 'run-1',
        leaseOwner: 'worker-2',
        now: new Date('2026-07-24T05:01:03.000Z'),
        checkpointCursor: 'done',
      }),
    ).resolves.toBe(true);
    expect(run).toMatchObject({
      status: 'COMPLETED',
      leaseOwner: null,
      leaseUntil: null,
      checkpointCursor: 'done',
      attempt: 2,
    });
  });

  it('counts the in-month portion of an approved leave range that starts in the prior month', async () => {
    let queryWhere: unknown;
    let approvedDays: unknown;
    const database = {
      approvalRequest: {
        findMany: async (input: { where: unknown }) => {
          queryWhere = input.where;
          return [
            {
              requestedByMembershipId: 'member-1',
              branchId: 'branch-1',
              requestType: 'LEAVE_SCHEDULE',
              payloadJson: {
                durationKind: 'DATE_RANGE',
                startDate: '2026-06-30',
                endDate: '2026-07-02',
              },
            },
          ];
        },
      },
      monthlyAbsenceSummary: {
        upsert: async (input: { create: { approvedAbsenceDaysDecimal: number } }) => {
          approvedDays = input.create.approvedAbsenceDaysDecimal;
          return input.create;
        },
      },
      actionItem: {
        updateMany: async () => ({ count: 0 }),
      },
    };
    const repository = new AttendanceWorkerRepository(database as never);

    await repository.refreshMonthlyAbsenceSummaries({
      tenantId: 'tenant-1',
      yearMonth: '2026-07',
    });

    expect(queryWhere).toMatchObject({
      businessDate: { lt: new Date('2026-08-01T00:00:00.000Z') },
    });
    expect(approvedDays).toBe(2);
  });
});
