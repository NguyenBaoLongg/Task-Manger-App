import type { KpiEvidenceRepository } from '@adsup/database';
import { EvidenceDebtService } from './evidence-debt-service.js';

export class EvidenceDebtRunner {
  private readonly service: EvidenceDebtService;

  constructor(private readonly repository: KpiEvidenceRepository) {
    this.service = new EvidenceDebtService(repository);
  }

  async run(input: { tenantId: string; now?: Date; limit?: number }) {
    const now = input.now ?? new Date();
    const reminders = await this.repository.listUnreminded(input.tenantId, input.limit);
    let reminded = 0;
    for (const candidate of reminders) {
      if (await this.service.remind(input.tenantId, candidate.id, now)) {
        reminded += 1;
      }
    }
    const candidates = await this.repository.listDue(input.tenantId, now, input.limit);
    let finalized = 0;
    let penalties = 0;
    for (const candidate of candidates) {
      const result = await this.service.finalize(input.tenantId, candidate.id, now);
      if (result.finalized) {
        finalized += 1;
        if (result.penalty) penalties += 1;
      }
    }
    return { processed: candidates.length, reminded, finalized, penalties };
  }
}
