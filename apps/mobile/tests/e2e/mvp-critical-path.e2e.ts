import { expect } from 'detox';
import { signInToDashboard, tapId, waitForId } from './helpers';

describe('MVP critical path', () => {
  it('signs in, selects seeded scope and reaches the core Module 1-4 mobile surfaces', async () => {
    await signInToDashboard({ 'ui-test-profile': 'MVP_CRITICAL_PATH' });

    await tapId('dashboard.attendance-button');
    await expect(await waitForId('attendance.screen')).toBeVisible();

    await signInToDashboard({ 'ui-test-profile': 'MVP_CRITICAL_PATH_BOOKING' });
    await tapId('dashboard.booking-button');
    await expect(await waitForId('booking.calendar.screen')).toBeVisible();

    // The booking routes live outside the `(tabs)` group, so the tab bar is not on screen while
    // the calendar is open and `tab.chat` cannot be tapped from there. Relaunch into the tabbed
    // shell first, matching how this test already re-enters before each surface group.
    await signInToDashboard({ 'ui-test-profile': 'MVP_CRITICAL_PATH_CHAT' });
    await tapId('tab.chat');
    await expect(await waitForId('chat.screen')).toBeVisible();
    await expect(await waitForId('chat.badge-strip')).toBeVisible();
  });
});
