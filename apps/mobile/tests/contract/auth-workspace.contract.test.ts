import fs from 'node:fs';
import path from 'node:path';

describe('auth and workspace contract', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/001-multitenant-foundation/contracts/openapi.yaml'),
    'utf8',
  );

  it('publishes Google auth, profile, memberships and branch reads', () => {
    expect(contract).toContain('/v1/auth/google:');
    expect(contract).toContain('/v1/me:');
    expect(contract).toContain('/v1/me/tenants:');
    expect(contract).toContain('/v1/tenants/{tenantId}/branches:');
  });
});
