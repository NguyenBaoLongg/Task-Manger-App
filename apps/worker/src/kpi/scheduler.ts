import { snapshotPolicyInstants } from '@adsup/domain';
import type { DatabaseClient } from '@adsup/database';
import type { CloseDayRunner } from './close-day-runner.js';
import type { EvidenceDebtRunner } from './evidence-debt-runner.js';
import type { RerunRunner } from './rerun-runner.js';

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

export class KpiScheduler {
  constructor(
    private readonly db: DatabaseClient,
    private readonly closeDay: CloseDayRunner,
    private readonly evidence: EvidenceDebtRunner,
    private readonly reruns: RerunRunner,
  ) {}

  async tick(now = new Date()) {
    const tenants = await this.db.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, timezone: true },
    });
    const results = [];
    for (const tenant of tenants) {
      const businessDate = localBusinessDate(now, tenant.timezone);
      const date = new Date(`${businessDate}T00:00:00.000Z`);
      const policies = await this.db.dailyKpiPolicyVersion.findMany({
        where: {
          tenantId: tenant.id,
          effectiveFromDate: { lte: date },
          OR: [{ effectiveToDate: null }, { effectiveToDate: { gte: date } }],
        },
      });
      if (policies.length > 0) {
        const lastEvaluation = Math.max(
          ...policies.map((policy) =>
            snapshotPolicyInstants(policy, businessDate).evaluationAt.getTime(),
          ),
        );
        if (now.getTime() >= lastEvaluation) {
          results.push(await this.closeDay.run({ tenantId: tenant.id, businessDate: date, now }));
        }
      }
      await this.evidence.run({ tenantId: tenant.id, now });
      await this.reruns.runPending(tenant.id, now);
    }
    return results;
  }
}
