import {
  createNativeActionResponseHandler,
  handleNativeAction,
  normalizeNativeAction,
} from '@/notifications/native-action-handler';
import { createTenantContext } from '@/tenant/tenant-context';
import { mobileFixture } from '../fixtures/mobile-fixture';

const branch = mobileFixture.branches[0]!;

const context = createTenantContext({
  branchId: branch.id,
  membershipId: mobileFixture.membership.id,
  permissions: ['booking.arrive', 'booking.outcome.manage'],
  tenantId: mobileFixture.tenant.id,
  version: 1,
});

const arrivedIntent = {
  action: 'ARRIVED_PROOF' as const,
  branchId: branch.id,
  deepLink: '/booking/booking-demo',
  receivedAt: 1,
  tenantId: mobileFixture.tenant.id,
};

const cancelIntent = {
  ...arrivedIntent,
  action: 'CANCEL_OR_RESCHEDULE' as const,
  deepLink: '/booking/outcome?bookingId=booking-demo',
};

describe('native quick-action normalization', () => {
  it.each([
    ['ios', 'com.adsup.action.ARRIVED_PROOF', 'ARRIVED_PROOF'],
    ['android', 'ADSUP_ARRIVED_PROOF', 'ARRIVED_PROOF'],
    ['ios', 'com.adsup.action.CANCEL_OR_RESCHEDULE', 'CANCEL_OR_RESCHEDULE'],
    ['android', 'ADSUP_CANCEL_OR_RESCHEDULE', 'CANCEL_OR_RESCHEDULE'],
  ] as const)(
    '%s maps platform identifiers before shared validation',
    (platform, identifier, action) => {
      expect(normalizeNativeAction({ identifier, platform })).toEqual({
        action,
        platform,
      });
    },
  );

  it('delegates ARRIVED_PROOF to the shared resolver and proof flow', async () => {
    const submit = jest.fn<Promise<void>, []>(async () => undefined);
    const resolveProof = jest.fn<Promise<boolean>, []>(async () => true);

    await expect(
      handleNativeAction(
        { identifier: 'com.adsup.action.ARRIVED_PROOF', intent: arrivedIntent, platform: 'ios' },
        {
          authenticated: true,
          context,
          now: 2,
          permissions: ['booking.arrive'],
          resolveProof,
          submit,
        },
      ),
    ).resolves.toEqual({ action: 'ARRIVED_PROOF', kind: 'open', route: '/booking/booking-demo' });
    expect(resolveProof).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('delegates CANCEL_OR_RESCHEDULE to the shared resolver and reason flow', async () => {
    const submit = jest.fn<Promise<void>, []>(async () => undefined);
    const resolveProof = jest.fn<Promise<boolean>, []>(async () => true);
    const handler = createNativeActionResponseHandler({
      authenticated: true,
      context,
      now: 2,
      permissions: ['booking.outcome.manage'],
      resolveProof,
      submit,
    });

    await expect(
      handler({
        identifier: 'ADSUP_CANCEL_OR_RESCHEDULE',
        intent: cancelIntent,
        platform: 'android',
      }),
    ).resolves.toEqual({
      action: 'CANCEL_OR_RESCHEDULE',
      kind: 'open',
      route: '/booking/outcome?bookingId=booking-demo',
    });
    expect(resolveProof).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('does not run a native mutation when resolver rejects the intent', async () => {
    const submit = jest.fn<Promise<void>, []>(async () => undefined);
    const resolveProof = jest.fn<Promise<boolean>, []>(async () => true);

    await expect(
      handleNativeAction(
        {
          identifier: 'ARRIVED_PROOF',
          intent: { ...arrivedIntent, tenantId: 'foreign-tenant' },
          platform: 'android',
        },
        {
          authenticated: true,
          context,
          now: 2,
          permissions: ['booking.arrive'],
          resolveProof,
          submit,
        },
      ),
    ).resolves.toEqual({ kind: 'forbidden' });
    expect(resolveProof).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
