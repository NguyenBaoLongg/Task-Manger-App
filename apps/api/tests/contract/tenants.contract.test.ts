import { describe, it } from 'vitest';
import { expectOperations } from '../helpers/contracts.js';

describe('tenant HTTP contract', () => {
  it('covers creation, listing and invitation lifecycle', async () => {
    await expectOperations([
      'createTenant',
      'listCurrentUserTenants',
      'getTenant',
      'updateTenantStatus',
      'createInvitation',
      'listInvitations',
      'revokeInvitation',
      'acceptInvitation',
    ]);
  });
});
