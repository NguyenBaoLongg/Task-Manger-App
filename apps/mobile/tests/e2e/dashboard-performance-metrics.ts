export const STARTUP_METRIC_PREFIX = 'ADSUP_SC003 ';

export type NativeStartupMetric = {
  durationMs: number;
  endedAtUptimeMs: number;
  sequence: number;
  source: 'process' | 'navigation';
  startedAtUptimeMs: number;
};

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isNativeStartupMetric = (value: unknown): value is NativeStartupMetric => {
  if (typeof value !== 'object' || value === null) return false;
  const metric = value as Record<string, unknown>;
  return (
    isFiniteNonNegative(metric.durationMs) &&
    isFiniteNonNegative(metric.startedAtUptimeMs) &&
    isFiniteNonNegative(metric.endedAtUptimeMs) &&
    isFiniteNonNegative(metric.sequence) &&
    (metric.source === 'process' || metric.source === 'navigation')
  );
};

export const parseLatestStartupMetric = (logcatOutput: string): NativeStartupMetric | undefined => {
  const lines = logcatOutput.split(/\r?\n/).reverse();
  for (const line of lines) {
    const markerIndex = line.indexOf(STARTUP_METRIC_PREFIX);
    if (markerIndex < 0) continue;
    try {
      const value: unknown = JSON.parse(line.slice(markerIndex + STARTUP_METRIC_PREFIX.length));
      if (isNativeStartupMetric(value)) return value;
    } catch {
      // Ignore partially-written or unrelated log lines and keep looking for a complete marker.
    }
  }
  return undefined;
};
