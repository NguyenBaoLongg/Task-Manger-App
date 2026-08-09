import { device } from 'detox';
import jestExpect from 'expect';
import { emitDetoxMetric, signInToDashboard, waitForId } from './helpers';

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

const profiles: DashboardProfile[] = ['COLD_START', 'WARM_CACHE', 'DEGRADED_NETWORK'];

const runDashboardSample = async (profile: DashboardProfile, run: number): Promise<number> => {
  await signInToDashboard(
    {
      'ui-test-data-profile': profile,
      'ui-test-profile': 'SC-003',
      'ui-test-run': String(run),
    },
    { delete: profile === 'COLD_START' || run === 1 },
  );

  const startedAt = Date.now();
  await device.reloadReactNative();
  await waitForId('dashboard.screen');

  return Date.now() - startedAt;
};

/**
 * 60 samples (20 runs x 3 data profiles), each preceded by an untimed sign-in and, for cold
 * starts, a reinstall. On this host that setup dominates and the suite reached 1806s against a
 * 1800s cap, so it timed out before the aggregate was ever emitted. Only `reloadReactNative` plus
 * the dashboard wait is measured against SC-003's 3s limit, and total suite duration is not part
 * of the criterion, so the cap is raised rather than the sample count reduced.
 */
jest.setTimeout(3_600_000);

describe('SC-003 dashboard performance', () => {
  it('shows first actionable dashboard data under 3 seconds for at least 19 of 20 runs per profile', async () => {
    const samples: PerformanceSample[] = [];

    for (const profile of profiles) {
      for (let run = 1; run <= RUN_COUNT; run += 1) {
        try {
          const durationMs = await runDashboardSample(profile, run);
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

    const byProfile = profiles.reduce<Record<DashboardProfile, number>>(
      (accumulator, profile) => ({
        ...accumulator,
        [profile]: samples.filter((sample) => sample.profile === profile && sample.passed).length,
      }),
      { COLD_START: 0, DEGRADED_NETWORK: 0, WARM_CACHE: 0 },
    );

    emitDetoxMetric('SC003_DASHBOARD_PERFORMANCE', {
      denominatorPerProfile: RUN_COUNT,
      limitMs: LIMIT_MS,
      passThreshold: PASS_THRESHOLD,
      profiles: byProfile,
      samples,
    });

    // Detox replaces the global `expect` with its own matcher API, which rejects a plain number.
    // Jest's `expect` is imported directly so the per-profile verdict is actually asserted.
    for (const profile of profiles) {
      jestExpect(byProfile[profile]).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    }
  });
});
