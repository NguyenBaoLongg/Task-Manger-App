import { by, device, element, expect } from 'detox';
import { readDetoxEnv, signInToDashboard, tapId, waitForId } from './helpers';

describe('booking critical path smoke', () => {
  it('covers dynamic form creation, calendar access, ARRIVED proof and reschedule surfaces', async () => {
    await signInToDashboard({ 'ui-test-profile': 'US4_BOOKING' });

    await tapId('dashboard.booking-button');
    await waitForId('booking.calendar.screen');

    await device.openURL({ url: 'adsup://booking/create' });
    await waitForId('booking.create.screen');
    await expect(await waitForId('booking.create.scheduled-start')).toBeVisible();
    await expect(await waitForId('booking.create.scheduled-submit')).toBeVisible();
    await expect(await waitForId('booking.create.walk-in-submit')).toBeVisible();

    const seededBookingId = readDetoxEnv('DETOX_SEEDED_BOOKING_ID');
    if (seededBookingId.length > 0) {
      await device.openURL({ url: `adsup://booking/${seededBookingId}` });
      await waitForId('booking.detail.screen');
      await expect(await waitForId('booking.detail.arrived-proof')).toBeVisible();
      await tapId('booking.detail.outcome-button');
      await waitForId('booking.outcome.screen');
      await element(by.id('booking.outcome.state-version')).replaceText('0');
      await expect(await waitForId('booking.outcome.reschedule-submit')).toBeVisible();
      await expect(await waitForId('booking.outcome.cancel-submit')).toBeVisible();
    }
  });
});
