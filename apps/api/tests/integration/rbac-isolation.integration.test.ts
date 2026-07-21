import { describe, expect, it } from 'vitest';
import { authorize } from '@adsup/domain';

describe('tenant and branch isolation matrix', () => {
  it.each([
    ['foreign branch', 'branch-b', false],
    ['same branch', 'branch-a', true],
  ])('%s', (_name, branchId, allowed) => {
    const result = authorize({
      tenantId: 'tenant-a',
      membershipId: 'member-a',
      membershipStatus: 'ACTIVE',
      permission: 'member.manage',
      requestedBranchId: branchId,
      now: new Date('2026-07-19T00:00:00Z'),
      bindings: [
        {
          permission: 'member.manage',
          scopeType: 'BRANCH',
          branchId: 'branch-a',
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    });
    expect(result.allowed).toBe(allowed);
  });
});
