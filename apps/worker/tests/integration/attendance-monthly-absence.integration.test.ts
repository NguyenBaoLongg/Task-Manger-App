import { describe, expect, it } from 'vitest';
import { MonthlyAbsenceRunner } from '../../src/attendance/monthly-absence-runner.js';

describe('attendance monthly absence runner', () => {
  it('emits one idempotent manager notification and flags over-threshold employees', async () => {
    const repository = {
      runs: 0,
      async refreshMonthlyAbsenceSummaries() {
        this.runs += 1;
        return [
          {
            tenantId: 'tenant-1',
            id: 'summary-1',
            membershipId: 'member-1',
            branchId: 'branch-1',
            yearMonth: '2026-07',
            approvedAbsenceDaysDecimal: { toString: () => '5.5' },
            overThreshold: true,
            notifiedManagerAt: null,
          },
        ];
      },
      async markMonthlyAbsenceNotified(input: { id: string; notificationEffectKey: string }) {
        expect(input).toMatchObject({
          id: 'summary-1',
          notificationEffectKey: 'attendance-monthly-absence:tenant-1:member-1:2026-07',
        });
      },
    };
    const runner = new MonthlyAbsenceRunner(repository);
    await expect(
      runner.runTenantMonth({ tenantId: 'tenant-1', yearMonth: '2026-07' }),
    ).resolves.toEqual({
      processed: 1,
      notified: 1,
      overThreshold: 1,
    });
    await expect(
      runner.runTenantMonth({ tenantId: 'tenant-1', yearMonth: '2026-07' }),
    ).resolves.toMatchObject({
      processed: 1,
      overThreshold: 1,
    });
    expect(repository.runs).toBe(2);
  });
});
