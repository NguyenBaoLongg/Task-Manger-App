import { device, expect } from 'detox';
import { tapId, waitForId } from './helpers';

describe('accessibility smoke', () => {
  it('runs through the canonical accessibility launch profile and reaches labelled surfaces', async () => {
    await device.launchApp({
      delete: true,
      launchArgs: { 'ui-test-accessibility': 'true', 'ui-test-appearance': 'light' },
      newInstance: true,
    });

    await expect(await waitForId('auth.sign-in')).toBeVisible();
    await tapId('auth.sign-in');
    await expect(await waitForId('workspace.option')).toBeVisible();
  });
});
