import fs from 'node:fs';
import path from 'node:path';

describe('member permissions contract (008)', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/001-multitenant-foundation/contracts/openapi.yaml'),
    'utf8',
  );

  it('publishes the authenticated own-permissions endpoint', () => {
    expect(contract).toContain('/v1/tenants/{tenantId}/me/permissions:');
  });
});
