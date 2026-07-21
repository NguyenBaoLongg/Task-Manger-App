import { describe, expect, it } from 'vitest';
import { ProblemError } from '@adsup/domain';
import type { OrganizationRbacRepository } from '@adsup/database';
import { RbacService } from '../../src/modules/rbac/rbac-service.js';

describe('RBAC invariants', () => {
  it('blocks suspension of the last active owner', async () => {
    const repository = {
      async updateMembershipWithOwnerGuard() {
        throw new ProblemError(
          409,
          'LAST_OWNER_REQUIRED',
          'Doanh nghiệp phải còn ít nhất một chủ doanh nghiệp hoạt động.',
        );
      },
    } as unknown as OrganizationRbacRepository;
    const service = new RbacService(repository);
    await expect(
      service.updateMembership({
        tenantId: 't',
        membershipId: 'm',
        actorMembershipId: 'm',
        correlationId: 'test-owner',
        status: 'SUSPENDED',
        reason: 'Kiểm thử chủ cuối cùng',
      }),
    ).rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
  });
});
