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
    await element(by.id('chat.composer')).replaceText('Detox seeded message');
    await expect(await waitForId('chat.send')).toBeVisible();

    await tapId('chat.back');
    await waitForId('chat.screen');

    await device.openURL({ url: 'adsup://notifications' });
    await waitForId('notifications.screen');
    await expect(await waitForId('notifications.photo_debt')).toBeVisible();
    await expect(await waitForId('notifications.approval')).toBeVisible();
    await expect(await waitForId('notifications.quick_action')).toBeVisible();
  });
});
