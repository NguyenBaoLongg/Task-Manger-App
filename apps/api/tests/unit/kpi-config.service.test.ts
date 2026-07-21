import { describe, expect, it, vi } from 'vitest';
import { KpiConfigService } from '../../src/modules/kpi/kpi-config-service.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const actorMembershipId = '20000000-0000-4000-8000-000000000001';
const kpiDefinitionId = '30000000-0000-4000-8000-000000000001';

describe('KPI configuration service', () => {
  it('normalizes immutable definition identifiers', async () => {
    const createDefinition = vi.fn((value: unknown) => value);
    const service = new KpiConfigService({ createDefinition } as never);
    await service.createDefinition({
      tenantId,
      actorMembershipId,
      correlationId: 'config-definition',
      code: ' revenue_daily ',
      name: ' Doanh số ',
      valueType: 'MONEY',
      unit: 'VND',
      direction: 'AT_LEAST',
      sourceType: 'FORM_FIELD',
      reason: 'Tạo KPI doanh số',
    });
    expect(createDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'REVENUE_DAILY', name: 'Doanh số' }),
    );
  });

  it('types target values from the definition and rejects unit mismatch', async () => {
    const createTargetVersion = vi.fn((value: unknown) => value);
    const service = new KpiConfigService({
      getDefinition: vi
        .fn()
        .mockResolvedValue({ id: kpiDefinitionId, valueType: 'MONEY', unit: 'VND' }),
      createTargetVersion,
    } as never);
    const base = {
      tenantId,
      actorMembershipId,
      correlationId: 'config-target',
      kpiDefinitionId,
      scopeType: 'MEMBERSHIP' as const,
      scopeId: actorMembershipId,
      required: true,
      effectiveFrom: new Date('2026-07-19T00:00:00Z'),
      reason: 'KPI riêng nhân viên',
    };
    await service.createTarget({ ...base, target: { value: '100000', unit: 'VND' } });
    expect(createTargetVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        // Vitest asymmetric matchers are intentionally typed as any.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        target: expect.objectContaining({ valueType: 'MONEY', atomic: 100000n }),
      }),
    );
    await expect(
      service.createTarget({ ...base, target: { value: '100000', unit: 'TASK' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
