import { by, device, element, waitFor } from 'detox';

export const VISIBILITY_TIMEOUT_MS = 15_000;

export const waitForId = async (testID: string, timeout = VISIBILITY_TIMEOUT_MS) => {
  const target = element(by.id(testID));

  await waitFor(target).toBeVisible().withTimeout(timeout);

  return target;
};

export const tapId = async (testID: string) => {
  await (await waitForId(testID)).tap();
};

export const readDetoxEnv = (key: string): string => {
  const value: unknown = process.env[key];

  return typeof value === 'string' ? value : '';
};

export const signInToDashboard = async (
  launchArgs: Record<string, string> = {},
  options: { delete?: boolean } = {},
) => {
  await device.launchApp({
    delete: options.delete ?? true,
    launchArgs,
    newInstance: true,
  });

  await tapId('auth.sign-in');
  await tapId('workspace.option');
  await tapId('branch.option');
  await waitForId('dashboard.screen');
};

export const emitDetoxMetric = (marker: string, payload: Record<string, unknown>) => {
  process.stdout.write(`${JSON.stringify({ marker, ...payload })}\n`);
};
