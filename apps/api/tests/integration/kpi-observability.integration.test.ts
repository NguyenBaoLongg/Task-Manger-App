import { describe, expect, it } from 'vitest';
import { Metrics } from '../../src/observability/index.js';
import { kpiJsonSafe } from '../../src/modules/kpi/kpi-http.js';

describe('KPI observability safety', () => {
  it('serializes exact money without losing precision or leaking request payloads', () => {
    expect(
      kpiJsonSafe({ amountMinor: 9_007_199_254_740_993n, at: new Date('2026-07-19T13:00:00Z') }),
    ).toEqual({ amountMinor: '9007199254740993', at: '2026-07-19T13:00:00.000Z' });
  });

  it('uses bounded metric names and never places tenant IDs in labels', () => {
    const api = new Metrics();
    api.increment('kpi_evaluations_total');
    api.increment('worker_ticks_total');
    const snapshot = api.snapshot();
    expect(snapshot).toMatchObject({ kpi_evaluations_total: 1, worker_ticks_total: 1 });
    expect(JSON.stringify(snapshot)).not.toContain('10000000-0000-4000-8000-000000000001');
  });
});
