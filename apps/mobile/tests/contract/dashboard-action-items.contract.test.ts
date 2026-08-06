import fs from 'node:fs';
import path from 'node:path';

describe('dashboard and action-item contract', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/002-okr-kpi-engine/contracts/openapi.yaml'),
    'utf8',
  );
  it('publishes KPI progress and employee/manager action-item reads', () => {
    expect(contract).toContain('/v1/tenants/{tenantId}/kpi/reports/{businessDate}/progress:');
    expect(contract).toContain('/v1/tenants/{tenantId}/action-items:');
    expect(contract).toContain('/v1/tenants/{tenantId}/management/action-items:');
    for (const field of [
      'branchId',
      'departmentId',
      'membershipId',
      'itemType',
      'state',
      'from',
      'to',
    ])
      expect(contract).toContain(`name: ${field}`);
  });
});
