import { device, expect } from 'detox';
import { readDetoxEnv, signInToDashboard, waitForId } from './helpers';

const cases = [
  {
    action: 'ARRIVED_PROOF',
    identifier: 'com.adsup.action.ARRIVED_PROOF',
    platform: 'ios',
    route: (bookingId: string) => `adsup://booking/${bookingId}`,
  },
  {
    action: 'CANCEL_OR_RESCHEDULE',
    identifier: 'com.adsup.action.CANCEL_OR_RESCHEDULE',
    platform: 'ios',
    route: (bookingId: string) => `adsup://booking/outcome?bookingId=${bookingId}`,
  },
  {
    action: 'ARRIVED_PROOF',
    identifier: 'ADSUP_ARRIVED_PROOF',
    platform: 'android',
    route: (bookingId: string) => `adsup://booking/${bookingId}`,
  },
  {
    action: 'CANCEL_OR_RESCHEDULE',
    identifier: 'ADSUP_CANCEL_OR_RESCHEDULE',
    platform: 'android',
    route: (bookingId: string) => `adsup://booking/outcome?bookingId=${bookingId}`,
  },
] as const;

describe('native quick actions', () => {
  it.each(cases)(
    'normalizes $platform $action and falls back to the authenticated route',
    async ({ action, identifier, platform, route }) => {
      await signInToDashboard({
        'ui-test-native-action': action,
        'ui-test-native-action-id': identifier,
        'ui-test-platform': platform,
        'ui-test-profile': 'US5_NATIVE_QUICK_ACTIONS',
      });

      const seededBookingId = readDetoxEnv('DETOX_SEEDED_BOOKING_ID');
      if (seededBookingId.length > 0) {
        await device.openURL({ url: route(seededBookingId) });
        await expect(
          await waitForId(
            action === 'ARRIVED_PROOF' ? 'booking.detail.screen' : 'booking.outcome.screen',
          ),
        ).toBeVisible();
        return;
      }

      await device.openURL({ url: 'adsup://notifications' });
      await expect(await waitForId('notifications.quick_action')).toBeVisible();
    },
  );
});
