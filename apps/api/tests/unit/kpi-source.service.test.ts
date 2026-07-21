import { describe, expect, it, vi } from 'vitest';
import { KpiSourceService } from '../../src/modules/kpi/kpi-source-service.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const membershipId = '20000000-0000-4000-8000-000000000001';
const branchId = '30000000-0000-4000-8000-000000000001';
const mapping = {
  id: '40000000-0000-4000-8000-000000000001',
  sourceType: 'FORM_FIELD',
  formTemplateId: '50000000-0000-4000-8000-000000000001',
  formVersionId: '60000000-0000-4000-8000-000000000001',
  jsonPointer: '/metrics/revenue',
};
const submission = {
  id: '70000000-0000-4000-8000-000000000001',
  tenantId,
  submittedByMembershipId: membershipId,
  branchId,
  formTemplateId: mapping.formTemplateId,
  formVersionId: mapping.formVersionId,
  data: { metrics: { revenue: '7500000' } },
  submittedAt: new Date('2026-07-19T11:00:00Z'),
};

describe('KPI source service', () => {
  it('reads and normalizes a tenant-owned JSON Pointer value', async () => {
    const service = new KpiSourceService({ read: vi.fn() });
    await expect(
      service.read({
        tenantId,
        membershipId,
        branchId,
        businessDate: '2026-07-19',
        kpiCode: 'DAILY_REVENUE',
        mapping: mapping as never,
        submission: submission as never,
      }),
    ).resolves.toMatchObject({
      value: '7500000',
      sourceId: submission.id,
      sourceType: 'FORM_SUBMISSION',
    });
  });

  it('returns missing for a foreign employee source and delegates adapter mappings', async () => {
    const read = vi.fn().mockResolvedValue({
      value: '100',
      unit: 'PERCENT',
      observedAt: new Date(),
      sourceType: 'ATTENDANCE',
      sourceId: 'x',
      inputDigest: 'd',
    });
    const service = new KpiSourceService({ read });
    await expect(
      service.read({
        tenantId,
        membershipId: '80000000-0000-4000-8000-000000000001',
        branchId,
        businessDate: '2026-07-19',
        kpiCode: 'DAILY_REVENUE',
        mapping: mapping as never,
        submission: submission as never,
      }),
    ).resolves.toBeNull();
    await service.read({
      tenantId,
      membershipId,
      branchId,
      businessDate: '2026-07-19',
      kpiCode: 'ON_TIME_RATE',
      mapping: { ...mapping, sourceType: 'DOMAIN_ADAPTER' } as never,
      submission: null,
    });
    expect(read).toHaveBeenCalledOnce();
  });
});
