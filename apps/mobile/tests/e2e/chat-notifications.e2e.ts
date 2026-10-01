import { by, device, element, expect } from 'detox';
import { signInToDashboard, tapId, waitForId } from './helpers';

describe('chat and notification smoke', () => {
  it('covers chat reconnect surface, badge dedupe surface, notification deep link and fallback rows', async () => {
    await signInToDashboard({ 'ui-test-profile': 'US5_CHAT_NOTIFICATIONS' });

    // The chat tab is a conversation list now, so composing means opening a conversation first.
    // That is the real flow a user takes and the previous single-screen assertion could not cover.
    await tapId('tab.chat');
    await waitForId('chat.screen');
    await expect(await waitForId('chat.badge-strip')).toBeVisible();
    await expect(await waitForId('chat.conversation-list')).toBeVisible();

    await tapId('chat.conversation-list.first');
    await waitForId('chat.conversation');
    await expect(await waitForId('chat.message-list')).toBeVisible();
    // Seed messages persist in the live database between runs, so the body must be unique per
    // run or `by.text` matches earlier seeds too.
    const seededBody = `Detox seeded ${Date.now()}`;
    await element(by.id('chat.composer')).replaceText(seededBody);
    await expect(await waitForId('chat.send')).toBeVisible();

    // Sending must render the message in the thread immediately; a client that fails to join the
    // channel room never receives `message:created` and would show nothing after this tap.
    await tapId('chat.send');
    await expect(element(by.text(seededBody))).toBeVisible();

    await tapId('chat.back');
    await waitForId('chat.screen');

    await device.openURL({ url: 'adsup://notifications' });
    await waitForId('notifications.screen');
    await expect(await waitForId('notifications.photo_debt')).toBeVisible();
    await expect(await waitForId('notifications.approval')).toBeVisible();
    await expect(await waitForId('notifications.quick_action')).toBeVisible();
  });
});
