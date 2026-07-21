import { ProblemError, resolvePolicy } from '@adsup/domain';
import type { BulkPolicyInput } from '@adsup/contracts';
import type { KpiRepository } from '@adsup/database';

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class KpiPolicyService {
  constructor(private readonly repository: KpiRepository) {}

  bulkCreate(
    input: BulkPolicyInput & {
      tenantId: string;
      actorMembershipId: string;
      correlationId: string;
    },
  ) {
    return this.repository.bulkCreatePolicyVersions({
      ...input,
      effectiveFromDate: asDate(input.effectiveFromDate),
      effectiveToDate: input.effectiveToDate ? asDate(input.effectiveToDate) : null,
      failurePenaltyMinor: BigInt(input.failurePenaltyMinor),
      photoPenaltyMinor: input.photoPenaltyMinor ? BigInt(input.photoPenaltyMinor) : null,
    });
  }

  async effective(tenantId: string, branchId: string, businessDate: string) {
    const candidates = await this.repository.listPolicyCandidates(tenantId, branchId, businessDate);
    const selected = resolvePolicy(candidates, branchId, businessDate);
    if (!selected)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không có policy KPI hiệu lực.');
    return selected;
  }
}
