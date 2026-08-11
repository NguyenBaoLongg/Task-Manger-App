import { execFileSync } from 'node:child_process';
import { device } from 'detox';
import jestExpect from 'expect';
import { emitDetoxMetric, readDetoxEnv, signInToDashboard, tapId, waitForId } from './helpers';

const RUN_COUNT = 20;
const PASS_THRESHOLD = 19;
const LIMIT_MS = 3_000;

type DashboardProfile = 'COLD_START' | 'WARM_CACHE' | 'DEGRADED_NETWORK';

type PerformanceSample = {
  durationMs: number;
  error?: string;
  passed: boolean;
  profile: DashboardProfile;
  run: number;
};

const allProfiles: DashboardProfile[] = ['COLD_START', 'WARM_CACHE', 'DEGRADED_NETWORK'];

/**
 * Running all three profiles in one test means 60 samples and roughly 90 minutes of sustained
 * emulator load, during which Detox has been observed to lose its connection to the app and the
 * host to become unusable. `ADSUP_SC003_PROFILES` runs a subset so each invocation stays short and
 * the machine recovers between them. Unset, the full sweep runs and the criterion is judged whole.
 */
const requestedProfiles = readDetoxEnv('ADSUP_SC003_PROFILES')
  .split(',')
  .map((name: string) => name.trim().toUpperCase())
  .filter((name: string): name is DashboardProfile =>
    (allProfiles as string[]).includes(name),
  );

const profiles: DashboardProfile[] = requestedProfiles.length ? requestedProfiles : allProfiles;

const adbPath = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';

/**
 * Shapes the emulator's virtual radio. `edge` yields roughly 58 KB/s with 80-400 ms latency, which
 * is a real transport constraint rather than an app-side simulation — the profile is therefore a
 * property of the environment and needs no test-only branch inside the shipped app.
 */
const setEmulatorNetwork = (speed: string, delay: string) => {
  execFileSync(adbPath, ['-s', device.id, 'emu', 'network', 'speed', speed], { stdio: 'ignore' });
  execFileSync(adbPath, ['-s', device.id, 'emu', 'network', 'delay', delay], { stdio: 'ignore' });
};

const restoreEmulatorNetwork = () => setEmulatorNetwork('full', 'none');

/**
 * A cold start: the process is gone and nothing is cached in memory. The stored session and
 * workspace selection are kept, because SC-003 measures the path *after* a valid session — the app
 * restores the workspace and then loads the dashboard.
 *
 * The window includes Detox's launch handshake, which a user never pays. That inflates the number,
 * so a passing result is trustworthy and a marginal failure deserves scrutiny before it is treated
 * as an app defect.
 */
const measureColdStart = async (run: number): Promise<number> => {
  const startedAt = Date.now();
  await device.launchApp({
    delete: false,
    launchArgs: { 'ui-test-profile': 'SC-003', 'ui-test-run': String(run) },
    newInstance: true,
  });
  await waitForId('dashboard.screen');
  return Date.now() - startedAt;
};

/**
 * A warm cache: the process is already running and the dashboard has been rendered at least once,
 * so its query data is resident. Navigating away and back is what a user does between tasks.
 */
const measureWarmCache = async (): Promise<number> => {
  await tapId('tab.workspace');
  await waitForId('workspace.screen');

  const startedAt = Date.now();
  await tapId('tab.dashboard');
  await waitForId('dashboard.screen');
  return Date.now() - startedAt;
};

jest.setTimeout(3_600_000);

describe('SC-003 dashboard performance', () => {
  beforeAll(async () => {
    restoreEmulatorNetwork();
    // One untimed sign-in establishes the session and workspace selection every profile builds on.
    await signInToDashboard({ 'ui-test-profile': 'SC-003' }, { delete: true });
  });

  afterAll(() => {
    restoreEmulatorNetwork();
  });

  it('shows first actionable dashboard data under 3 seconds for at least 19 of 20 runs per profile', async () => {
    const samples: PerformanceSample[] = [];

    for (const profile of profiles) {
      if (profile === 'DEGRADED_NETWORK') setEmulatorNetwork('edge', 'edge');
      else restoreEmulatorNetwork();

      if (profile === 'WARM_CACHE') {
        // Guarantee the cache is populated before the first warm sample.
        await measureColdStart(0);
      }

      for (let run = 1; run <= RUN_COUNT; run += 1) {
        try {
          const durationMs =
            profile === 'WARM_CACHE' ? await measureWarmCache() : await measureColdStart(run);
          samples.push({ durationMs, passed: durationMs <= LIMIT_MS, profile, run });
        } catch (error) {
          samples.push({
            durationMs: LIMIT_MS + 1,
            error: error instanceof Error ? error.message : String(error),
            passed: false,
            profile,
            run,
          });
        }
      }
    }

    restoreEmulatorNetwork();

    // Only profiles that actually ran are reported. A zero for a profile that was never executed
    // would be indistinguishable from a profile that failed every sample.
    const byProfile = profiles.reduce<Partial<Record<DashboardProfile, number>>>(
      (accumulator, profile) => ({
        ...accumulator,
        [profile]: samples.filter((sample) => sample.profile === profile && sample.passed).length,
      }),
      {},
    );

    emitDetoxMetric('SC003_DASHBOARD_PERFORMANCE', {
      denominatorPerProfile: RUN_COUNT,
      executedProfiles: profiles,
      limitMs: LIMIT_MS,
      networkProfile: { DEGRADED_NETWORK: 'emulator speed=edge delay=edge', other: 'full/none' },
      passThreshold: PASS_THRESHOLD,
      profiles: byProfile,
      samples,
    });

    // Detox replaces the global `expect` with its own matcher API, which rejects a plain number.
    // Jest's `expect` is imported directly so the per-profile verdict is actually asserted.
    for (const profile of profiles) {
      jestExpect(byProfile[profile] ?? 0).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    }
  });
});
