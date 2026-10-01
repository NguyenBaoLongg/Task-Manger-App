import { NativeModules } from 'react-native';
import {
  getReleaseE2eApiBaseUrl,
  markDashboardActionable,
  startDashboardNavigationMeasurement,
} from '@/native/adsup-runtime';

const modules = NativeModules as Record<string, unknown>;
const originalRuntimeModule = modules.AdsupRuntime;

describe('Adsup native runtime boundary', () => {
  afterEach(() => {
    modules.AdsupRuntime = originalRuntimeModule;
    jest.restoreAllMocks();
  });

  it('uses the releaseE2e-only API address exposed by Android', () => {
    modules.AdsupRuntime = { testApiBaseUrl: 'http://10.0.2.2:3000' };

    expect(getReleaseE2eApiBaseUrl()).toBe('http://10.0.2.2:3000');
  });

  it('starts and completes an in-app Dashboard navigation measurement', async () => {
    const start = jest.fn();
    const mark = jest.fn().mockResolvedValue({
      durationMs: 421,
      endedAtUptimeMs: 8_421,
      sequence: 4,
      source: 'navigation',
      startedAtUptimeMs: 8_000,
    });
    modules.AdsupRuntime = {
      markDashboardActionable: mark,
      startDashboardNavigationMeasurement: start,
    };

    startDashboardNavigationMeasurement();
    await expect(markDashboardActionable()).resolves.toMatchObject({
      durationMs: 421,
      source: 'navigation',
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid native duration instead of publishing a false metric', async () => {
    modules.AdsupRuntime = {
      markDashboardActionable: jest.fn().mockResolvedValue({
        durationMs: -1,
        endedAtUptimeMs: 1,
        sequence: 1,
        source: 'process',
        startedAtUptimeMs: 2,
      }),
      startDashboardNavigationMeasurement: jest.fn(),
    };

    await expect(markDashboardActionable()).rejects.toThrow('Invalid native startup metric');
  });
});
