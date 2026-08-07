import fs from 'node:fs';
import path from 'node:path';

describe('chat and notifications contract', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/001-multitenant-foundation/contracts/openapi.yaml'),
    'utf8',
  );
  it('publishes channel/message pagination and endpoint registration', () => {
    for (const route of [
      '/v1/tenants/{tenantId}/channels:',
      '/v1/tenants/{tenantId}/channels/{channelId}/messages:',
      '/v1/notification-endpoints:',
    ])
      expect(contract).toContain(route);
  });
});
