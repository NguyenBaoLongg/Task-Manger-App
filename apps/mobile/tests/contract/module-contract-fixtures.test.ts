import fs from 'node:fs';
import path from 'node:path';

const readContract = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../../specs', relativePath), 'utf8');

describe('mobile module contract map', () => {
  it('keeps the authentication and workspace operations published by Module 1', () => {
    const contract = readContract('001-multitenant-foundation/contracts/openapi.yaml');
    expect(contract).toContain('/v1/auth/google:');
    expect(contract).toContain('/v1/auth/refresh:');
    expect(contract).toContain('/v1/me/tenants:');
    expect(contract).toContain('/v1/tenants/{tenantId}/branches:');
  });

  it('keeps the action center, attendance and booking routes published by Modules 2-4', () => {
    const kpi = readContract('002-okr-kpi-engine/contracts/openapi.yaml');
    const attendance = readContract('003-timekeeping-workflows/contracts/openapi.yaml');
    const booking = readContract('004-booking-export/contracts/openapi.yaml');
    expect(kpi).toContain('/v1/tenants/{tenantId}/action-items:');
    expect(kpi).toContain('/v1/tenants/{tenantId}/management/action-items:');
    expect(attendance).toContain('/v1/tenants/{tenantId}/workflows/requests:');
    expect(booking).toContain('/v1/tenants/{tenantId}/bookings');
  });
});
