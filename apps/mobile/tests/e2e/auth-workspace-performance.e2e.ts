import { by, device, element, waitFor } from 'detox';

const RUN_COUNT = 20;
const PASS_THRESHOLD = 19;
const LIMIT_MS = 60_000;
const VISIBILITY_TIMEOUT_MS = 15_000;

type PerformanceSample = {
  durationMs: number;
  error?: string;
  passed: boolean;
  run: number;
};

const waitForVisible = async (testID: string) => {
  const target = element(by.id(testID));

  await waitFor(target).toBeVisible().withTimeout(VISIBILITY_TIMEOUT_MS);

  return target;
};

const runSeededLoginWorkspaceFlow = async (run: number): Promise<number> => {
  const startedAt = Date.now();

  await device.launchApp({
    delete: true,
    launchArgs: {
      'ui-test-profile': 'SC-001',
      'ui-test-run': String(run),
    },
    newInstance: true,
  });

  await (await waitForVisible('auth.sign-in')).tap();
  await (await waitForVisible('workspace.option')).tap();
  await (await waitForVisible('branch.option')).tap();
  await waitForVisible('dashboard.screen');

  return Date.now() - startedAt;
};

jest.setTimeout(1_800_000);

describe('SC-001 login/workspace performance', () => {
  it('completes at least 19 of 20 seeded login/workspace runs under 60 seconds', async () => {
    const samples: PerformanceSample[] = [];

    for (let run = 1; run <= RUN_COUNT; run += 1) {
      try {
        const durationMs = await runSeededLoginWorkspaceFlow(run);

        samples.push({
          durationMs,
          passed: durationMs <= LIMIT_MS,
          run,
        });
      } catch (error) {
        samples.push({
          durationMs: LIMIT_MS + 1,
          error: error instanceof Error ? error.message : String(error),
          passed: false,
          run,
        });
      }
    }

    const passCount = samples.filter((sample) => sample.passed).length;

    process.stdout.write(
      `${JSON.stringify({
        denominator: RUN_COUNT,
        limitMs: LIMIT_MS,
        marker: 'SC001_LOGIN_WORKSPACE_PERFORMANCE',
        passCount,
        passThreshold: PASS_THRESHOLD,
        samples,
      })}\n`,
    );

    expect(passCount).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });
});
