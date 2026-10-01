import { parseLatestStartupMetric } from '../e2e/dashboard-performance-metrics';

describe('SC-003 startup metric log parser', () => {
  it('returns the latest complete native metric', () => {
    const output = [
      '08-23 10:00:00.000 I/AdsupStartupMetrics(100): ADSUP_SC003 {"durationMs":1400,"endedAtUptimeMs":2400,"sequence":1,"source":"process","startedAtUptimeMs":1000}',
      '08-23 10:00:01.000 I/AdsupStartupMetrics(100): ADSUP_SC003 {"durationMs":380,"endedAtUptimeMs":3380,"sequence":2,"source":"navigation","startedAtUptimeMs":3000}',
    ].join('\n');

    expect(parseLatestStartupMetric(output)).toEqual({
      durationMs: 380,
      endedAtUptimeMs: 3380,
      sequence: 2,
      source: 'navigation',
      startedAtUptimeMs: 3000,
    });
  });

  it('ignores malformed and incomplete log lines', () => {
    const output = [
      'I/AdsupStartupMetrics: ADSUP_SC003 not-json',
      'I/AdsupStartupMetrics: ADSUP_SC003 {"durationMs":100}',
    ].join('\n');

    expect(parseLatestStartupMetric(output)).toBeUndefined();
  });
});
