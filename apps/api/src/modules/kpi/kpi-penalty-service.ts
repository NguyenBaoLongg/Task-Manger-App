import type { KpiRepository } from '@adsup/database';

export class KpiPenaltyService {
  constructor(private readonly repository: KpiRepository) {}

  adjust(input: {
    tenantId: string;
    penaltyId: string;
    deltaMinor: string;
    actorMembershipId: string;
    idempotencyKey: string;
    reason: string;
    correlationId: string;
  }) {
    return this.repository.createPenaltyAdjustment({
      ...input,
      deltaMinor: BigInt(input.deltaMinor),
    });
  }
}
