export interface MonthlyAbsenceSummaryLike {
  tenantId: string;
  id: string;
  membershipId: string;
  branchId: string;
  yearMonth: string;
  approvedAbsenceDaysDecimal: { toString(): string };
  overThreshold: boolean;
  notifiedManagerAt?: Date | string | null;
}

export interface MonthlyAbsenceRepositoryLike {
  refreshMonthlyAbsenceSummaries(input: {
    tenantId: string;
    yearMonth: string;
    thresholdDays?: number;
    correlationId?: string;
  }): Promise<MonthlyAbsenceSummaryLike[]>;
  markMonthlyAbsenceNotified(input: {
    tenantId: string;
    id: string;
    notificationEffectKey: string;
    correlationId?: string;
  }): Promise<unknown>;
}

export class MonthlyAbsenceRunner {
  constructor(private readonly repository: MonthlyAbsenceRepositoryLike) {}

  async runTenantMonth(input: {
    tenantId: string;
    yearMonth: string;
    thresholdDays?: number;
    correlationId?: string;
  }) {
    const summaries = await this.repository.refreshMonthlyAbsenceSummaries(input);
    let notified = 0;
    let overThreshold = 0;
    for (const summary of summaries) {
      if (!summary.overThreshold) continue;
      overThreshold += 1;
      if (summary.notifiedManagerAt) continue;
      const notificationEffectKey = `attendance-monthly-absence:${summary.tenantId}:${summary.membershipId}:${summary.yearMonth}`;
      await this.repository.markMonthlyAbsenceNotified({
        tenantId: summary.tenantId,
        id: summary.id,
        notificationEffectKey,
        correlationId: input.correlationId,
      });
      notified += 1;
    }
    return { processed: summaries.length, notified, overThreshold };
  }
}
