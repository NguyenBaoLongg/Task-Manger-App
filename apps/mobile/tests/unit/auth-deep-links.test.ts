import { createTenantContext } from '@/tenant/tenant-context';
import { resolveDeepLink } from '@/navigation/deep-link-resolver';

const context = createTenantContext({
  tenantId: 'tenant-a',
  membershipId: 'm-a',
  branchId: 'branch-a',
  permissions: ['booking.read'],
  version: 4,
});

describe('auth and deep-link guard', () => {
  it('opens a current same-scope read intent', () => {
    expect(
      resolveDeepLink(
        {
          tenantId: 'tenant-a',
          branchId: 'branch-a',
          deepLink: '/booking/b-1',
          receivedAt: 100,
          expiresAt: 200,
        },
        { context, now: 150, authenticated: true },
      ),
    ).toEqual({ kind: 'open', route: '/booking/b-1' });
  });

  it('returns safe states for expired session, foreign scope and stale intent', () => {
    expect(
      resolveDeepLink(
        { tenantId: 'tenant-a', deepLink: '/dashboard', receivedAt: 100, expiresAt: 200 },
        { context, now: 150, authenticated: false },
      ).kind,
    ).toBe('session-expired');
    expect(
      resolveDeepLink(
        { tenantId: 'tenant-b', deepLink: '/dashboard', receivedAt: 100, expiresAt: 200 },
        { context, now: 150, authenticated: true },
      ).kind,
    ).toBe('forbidden');
    expect(
      resolveDeepLink(
        { tenantId: 'tenant-a', deepLink: '/dashboard', receivedAt: 100, expiresAt: 120 },
        { context, now: 150, authenticated: true },
      ).kind,
    ).toBe('refresh');
  });
});
