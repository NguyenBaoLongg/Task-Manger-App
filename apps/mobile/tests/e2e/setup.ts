import { execFileSync } from 'node:child_process';
import { device } from 'detox';

/**
 * The release build embeds its API base URL at bundle time (`extra.apiBaseUrl` is
 * `http://localhost:3000`), so setting `EXPO_PUBLIC_API_BASE_URL` when invoking Detox has no effect
 * on it. On Android `localhost` resolves to the device, which means every emulator needs the API
 * port forwarded before the app can reach the developer's API.
 *
 * Forgetting this does not surface as a connection error: the app renders its sign-in screen, the
 * first tap succeeds, and Detox then fails on `workspace.option` with a visibility timeout — which
 * reads like a layout or app defect. Establishing the forward here removes that failure mode and
 * keeps every device profile on equal footing.
 *
 * `adb reverse` is per-device and does not survive a device restart, so it is re-applied for each
 * test file rather than assumed.
 */
const API_PORT = Number(process.env.ADSUP_E2E_API_PORT ?? 3000);

const adbPath = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';

beforeAll(() => {
  if (device.getPlatform() !== 'android') return;

  try {
    execFileSync(adbPath, ['-s', device.id, 'reverse', `tcp:${API_PORT}`, `tcp:${API_PORT}`], {
      stdio: 'ignore',
    });
  } catch (error) {
    // A missing forward is worth surfacing loudly, because the resulting failure is misleading.
    throw new Error(
      `Could not forward tcp:${API_PORT} to ${device.id}. The app cannot reach the local API ` +
        `without it. Underlying error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});
