import { createTenantContext } from '@/tenant/tenant-context';
import { tenantQueryKey, tenantRoom } from '@/tenant/tenant-scope';

describe('tenant context', () => {
  it('keeps tenant, branch, membership and context version in every scope key', () => {
    const context = createTenantContext({
      tenantId: 'tenant-a',
      membershipId: 'membership-a',
      branchId: 'branch-a',
      permissions: ['booking.read'],
      version: 3,
    });
    expect(tenantQueryKey(context, ['bookings', 'list'])).toEqual([
      'tenant',
      'tenant-a',
      'branch',
      'branch-a',
      'membership',
      'membership-a',
      'v',
      3,
      'bookings',
      'list',
    ]);
    expect(tenantRoom(context, 'action-items')).toBe(
      'tenant:tenant-a:branch:branch-a:action-items',
    );
    expect(context.can('booking.read')).toBe(true);
    expect(context.can('booking.write')).toBe(false);
  });

  it('rejects a resource from another tenant or branch before navigation', () => {
    const context = createTenantContext({
      tenantId: 'tenant-a',
      membershipId: 'm-a',
      branchId: 'branch-a',
      permissions: [],
      version: 1,
    });
    expect(context.assertScope({ tenantId: 'tenant-a', branchId: 'branch-a' })).toBe(true);
    expect(() => context.assertScope({ tenantId: 'tenant-b', branchId: 'branch-a' })).toThrow(
      'TENANT_SCOPE_MISMATCH',
    );
    expect(() => context.assertScope({ tenantId: 'tenant-a', branchId: 'branch-b' })).toThrow(
      'BRANCH_SCOPE_MISMATCH',
    );
  });
});
