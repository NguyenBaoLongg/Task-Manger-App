import { ProblemError, parseExactMetric } from '@adsup/domain';
import type {
  CreateKpiDefinitionInput,
  CreateSourceMappingInput,
  CreateTargetVersionInput,
} from '@adsup/contracts';
import type { KpiDefinition, KpiRepository } from '@adsup/database';

export class KpiConfigService {
  constructor(private readonly repository: KpiRepository) {}

  list(tenantId: string): Promise<KpiDefinition[]> {
    return this.repository.listDefinitions(tenantId);
  }

  createDefinition(
    input: CreateKpiDefinitionInput & {
      tenantId: string;
      actorMembershipId: string;
      correlationId: string;
    },
  ) {
    return this.repository.createDefinition({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
    });
  }

  async createTarget(
    input: CreateTargetVersionInput & {
      tenantId: string;
      actorMembershipId: string;
      correlationId: string;
    },
  ) {
    const definition = await this.repository.getDefinition(input.tenantId, input.kpiDefinitionId);
    if (!definition) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy KPI.');
    if (input.target.unit !== definition.unit) {
      throw new ProblemError(422, 'VALIDATION_FAILED', `Đơn vị target phải là ${definition.unit}.`);
    }
    const target = parseExactMetric(definition.valueType, input.target.value, input.target.unit);
    return this.repository.createTargetVersion({ ...input, target });
  }

  createSourceMapping(
    input: CreateSourceMappingInput & {
      tenantId: string;
      actorMembershipId: string;
      correlationId: string;
    },
  ) {
    return this.repository.createSourceMappingVersion(input);
  }
}
