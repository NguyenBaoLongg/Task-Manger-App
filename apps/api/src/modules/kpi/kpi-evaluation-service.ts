import { kpiDigest } from '@adsup/domain';
import type { KpiRepository, KpiWorkerRepository } from '@adsup/database';

export class KpiEvaluationService {
  constructor(
    private readonly repository: KpiRepository,
    private readonly worker: KpiWorkerRepository,
  ) {}

  list(input: Parameters<KpiRepository['listEvaluations']>[0]) {
    return this.repository.listEvaluations(input);
  }

  enqueueRerun(input: {
    tenantId: string;
    businessDate: Date;
    branchIds?: string[];
    membershipIds?: string[];
    reason: string;
    correlationId: string;
  }) {
    const branchIds = [...new Set(input.branchIds ?? [])].sort();
    const membershipIds = [...new Set(input.membershipIds ?? [])].sort();
    const scopeDigest = kpiDigest({ branchIds, membershipIds, reason: input.reason.trim() }).slice(
      0,
      24,
    );
    return this.worker.ensureRun({
      tenantId: input.tenantId,
      jobType: `DAILY_KPI_RERUN_${scopeDigest}`,
      businessDate: input.businessDate,
      correlationId: input.correlationId,
      payloadJson: {
        branchIds,
        membershipIds,
        reason: input.reason.trim(),
      },
    });
  }
}
