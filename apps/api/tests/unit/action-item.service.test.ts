import { describe, expect, it, vi } from 'vitest';
import { ActionItemService } from '../../src/modules/action-items/action-item-service.js';

const base = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  membershipId: '20000000-0000-4000-8000-000000000001',
  branchId: '30000000-0000-4000-8000-000000000001',
  businessDate: new Date('2026-07-19T00:00:00Z'),
  deadlineAt: new Date('2099-07-19T13:00:00Z'),
  sourceFreshnessAt: new Date('2026-07-19T11:00:00Z'),
  correlationId: 'test-action-item',
};

describe('action-item projection service', () => {
  it('projects and completes the unique report debt', async () => {
    const project = vi.fn().mockResolvedValue({ id: 'item' });
    const service = new ActionItemService({ project } as never);
    await service.projectKpiReport({
      ...base,
      reportId: '40000000-0000-4000-8000-000000000001',
      submitted: false,
    });
    await service.projectKpiReport({
      ...base,
      reportId: '40000000-0000-4000-8000-000000000001',
      submitted: true,
    });
    expect(project.mock.calls[0]?.[0]).toMatchObject({
      itemType: 'KPI_REPORT',
      state: 'OPEN',
      remainingValue: '1',
    });
    expect(project.mock.calls[1]?.[0]).toMatchObject({
      itemType: 'KPI_REPORT',
      state: 'COMPLETED',
      remainingValue: '0',
    });
  });

  it('projects exact KPI remaining values and a deep link', async () => {
    const project = vi.fn((input: { deepLink: string; remainingValue: string }) => input);
    const service = new ActionItemService({ project } as never);
    await service.projectKpiShortfall({
      ...base,
      reportId: '40000000-0000-4000-8000-000000000001',
      kpiDefinitionId: '50000000-0000-4000-8000-000000000001',
      definitionName: 'Doanh số',
      target: '10000000',
      actual: '7500000',
      remaining: '2500000',
      unit: 'VND',
      passed: false,
    });
    const projected = project.mock.calls[0]?.[0];
    expect(projected?.remainingValue).toBe('2500000');
    expect(projected?.deepLink).toContain('adsup://');
  });
});
