import { describe, expect, it } from 'vitest';
import { AttendanceRepository } from './attendance.repository.js';

describe('AttendanceRepository monthly late sequence', () => {
  it('allocates unique monthly sequences under concurrent check-ins', async () => {
    const occurrences: Array<{
      tenantId: string;
      attendanceEventId: string;
      membershipId: string;
      businessDate: Date;
      monthlyLateSequence: number;
      firstLateExempt: boolean;
    }> = [];
    let transactionTail = Promise.resolve();
    const transaction = {
      $executeRaw: async () => 0,
      lateOccurrence: {
        count: async (input: {
          where: {
            tenantId: string;
            membershipId: string;
            businessDate: { gte: Date; lt: Date };
          };
        }) =>
          occurrences.filter(
            (item) =>
              item.tenantId === input.where.tenantId &&
              item.membershipId === input.where.membershipId &&
              item.businessDate >= input.where.businessDate.gte &&
              item.businessDate < input.where.businessDate.lt,
          ).length,
        create: async (input: { data: (typeof occurrences)[number] }) => {
          occurrences.push(input.data);
          return input.data;
        },
      },
    };
    const database = {
      $transaction: async <T>(operation: (client: unknown) => Promise<T>) => {
        let release: () => void = () => {};
        const previous = transactionTail;
        transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await operation(transaction);
        } finally {
          release();
        }
      },
    };
    const repository = new AttendanceRepository(database as never);

    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        repository.createLateOccurrence({
          tenantId: 'tenant-1',
          attendanceEventId: `attendance-${index}`,
          membershipId: 'member-1',
          branchId: 'branch-1',
          businessDate: new Date(
            `2028-02-${String((index % 29) + 1).padStart(2, '0')}T00:00:00.000Z`,
          ),
          shiftStartAt: new Date('2028-02-01T01:30:00.000Z'),
          checkInAt: new Date('2028-02-01T01:31:00.000Z'),
          lateSeconds: 60,
          lateMinutes: 1,
          after15Local: false,
          after18Local: false,
          queueImpactFlag: true,
          policyVersionId: 'policy-1',
        }),
      ),
    );

    expect(occurrences.map((item) => item.monthlyLateSequence).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(occurrences.filter((item) => item.firstLateExempt)).toHaveLength(1);
  });
});
