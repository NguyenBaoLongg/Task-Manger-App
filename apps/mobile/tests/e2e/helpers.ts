import { by, device, element, waitFor } from 'detox';

export const VISIBILITY_TIMEOUT_MS = 15_000;

/**
 * Several screens render a list where every row carries the same `testID`
 * (`workspace.option`, `branch.option`, `booking.calendar.row`). Detox requires a matcher to
 * resolve to exactly one view, so against seeded data those matchers are ambiguous and the
 * interaction fails before the assertion is reached. `index` selects the row to act on;
 * `atIndex(0)` is also correct when only one view matches, so single-match callers are unaffected.
 */
export const waitForId = async (
  testID: string,
  { index = 0, timeout = VISIBILITY_TIMEOUT_MS }: { index?: number; timeout?: number } = {},
) => {
  const target = element(by.id(testID)).atIndex(index);

  await waitFor(target).toBeVisible().withTimeout(timeout);

  return target;
};

export const tapId = async (testID: string, index = 0) => {
  await (await waitForId(testID, { index })).tap();
};

export const readDetoxEnv = (key: string): string => {
  const value: unknown = process.env[key];

  return typeof value === 'string' ? value : '';
};

const RESTORE_PROBE_TIMEOUT_MS = 8_000;

/** Whether a view becomes visible within the probe window, without failing the test if it does not. */
const becomesVisible = async (testID: string, timeout: number) => {
  try {
    await waitFor(element(by.id(testID)).atIndex(0))
      .toBeVisible()
      .withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reaches the dashboard from whatever state the launch leaves the app in.
 *
 * A launch with `delete: false` keeps the stored session and workspace selection, so the app now
 * restores straight to the dashboard and never shows the sign-in screen. Driving the sign-in taps
 * unconditionally therefore failed on every relaunch that did not reinstall. Probing first keeps
 * both paths working: a fresh install still signs in, a warm relaunch is simply already there.
 */
export const signInToDashboard = async (
  launchArgs: Record<string, string> = {},
  options: { delete?: boolean } = {},
) => {
  await device.launchApp({
    delete: options.delete ?? true,
    launchArgs,
    newInstance: true,
  });

  if (await becomesVisible('dashboard.screen', RESTORE_PROBE_TIMEOUT_MS)) return;

  await tapId('auth.sign-in');
  await tapId('workspace.option');
  await tapId('branch.option');
  await waitForId('dashboard.screen');
};

export const emitDetoxMetric = (marker: string, payload: Record<string, unknown>) => {
  process.stdout.write(`${JSON.stringify({ marker, ...payload })}\n`);
};
