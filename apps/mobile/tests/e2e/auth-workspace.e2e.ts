import { expect } from 'detox';
import { signInToDashboard, tapId, waitForId } from './helpers';

/**
 * `signInToDashboard` selects the first branch, so switching must select a different one.
 * Tapping the first row again would re-select the current branch and the assertion would pass
 * without a switch ever happening. The seeded tenant provides more than one branch.
 */
const SECOND_BRANCH_INDEX = 1;

describe('auth and workspace smoke', () => {
  it('signs in, selects workspace and branch, switches branch, logs out and reauthenticates', async () => {
    await signInToDashboard({ 'ui-test-profile': 'US1_AUTH_WORKSPACE' });

    await tapId('tab.workspace');
    await waitForId('workspace.screen');
    await tapId('workspace.switch-branch');
    await tapId('branch.option', SECOND_BRANCH_INDEX);
    await waitForId('dashboard.screen');

    await tapId('tab.workspace');
    await tapId('workspace.logout');
    await expect(await waitForId('auth.sign-in')).toBeVisible();

    await tapId('auth.sign-in');
    await expect(await waitForId('workspace.option')).toBeVisible();
  });
});
