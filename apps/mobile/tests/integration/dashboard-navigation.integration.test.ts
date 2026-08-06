import { tabConfig } from '@/navigation/tab-config';
import { resolveActionItemRoute } from '@/navigation/action-item-route';
import { createTenantContext } from '@/tenant/tenant-context';

describe('dashboard navigation and scope integration', () => {
  it('publishes accessible tabs and routes action items through the shared resolver', () => {
    expect(tabConfig.map((item) => item.name)).toEqual(['dashboard', 'workspace', 'chat']);
    const context = createTenantContext({
      tenantId: 'tenant-a',
      membershipId: 'm-a',
      branchId: 'branch-a',
      permissions: ['booking.arrive'],
      version: 1,
    });
    expect(
      resolveActionItemRoute(
        {
          tenantId: 'tenant-a',
          branchId: 'branch-a',
          deepLink: '/booking/b-1',
          action: 'ARRIVED_PROOF',
          receivedAt: 1,
          expiresAt: 10,
        },
        { context, now: 5, authenticated: true, permissions: ['booking.arrive'] },
      ),
    ).toMatchObject({ kind: 'open' });
    expect(
      resolveActionItemRoute(
        {
          tenantId: 'tenant-b',
          deepLink: '/booking/b-1',
          action: 'ARRIVED_PROOF',
          receivedAt: 1,
          expiresAt: 10,
        },
        { context, now: 5, authenticated: true, permissions: ['booking.arrive'] },
      ),
    ).toEqual({ kind: 'forbidden' });
  });
});
