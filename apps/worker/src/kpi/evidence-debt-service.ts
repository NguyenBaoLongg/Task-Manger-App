import type { KpiEvidenceRepository } from '@adsup/database';

export class EvidenceDebtService {
  constructor(private readonly repository: KpiEvidenceRepository) {}

  remind(tenantId: string, debtId: string, now: Date) {
    return this.repository.markReminded({ tenantId, debtId, now });
  }

  async finalize(tenantId: string, debtId: string, now: Date) {
    const refreshed = await this.repository.refreshDebt({ tenantId, debtId, now });
    if (!refreshed || refreshed.debt.state !== 'OVERDUE') {
      return { finalized: false, penalty: false };
    }
    const penalty = await this.repository.assessPhotoPenalty({ tenantId, debtId, now });
    return { finalized: true, penalty: Boolean(penalty) };
  }
}
