import { describe, expect, it } from 'vitest';
import { evaluateDailyKpis, parseExactMetric } from './index.js';

const progress = (passed: boolean, required = true) => ({
  kpiDefinitionId: crypto.randomUUID(),
  required,
  passed,
  target: parseExactMetric('COUNT', '1', 'TASK'),
  actual: passed ? parseExactMetric('COUNT', '1', 'TASK') : null,
  remaining: parseExactMetric('COUNT', passed ? '0' : '1', 'TASK'),
  sourceStatus: passed ? ('FRESH' as const) : ('MISSING' as const),
});

describe('daily KPI evaluation', () => {
  it('passes only when all required KPI pass and report is eligible', () => {
    expect(
      evaluateDailyKpis({ hasEligibleReport: true, progress: [progress(true), progress(true)] })
        .status,
    ).toBe('PASSED');
    expect(
      evaluateDailyKpis({ hasEligibleReport: true, progress: [progress(true), progress(false)] })
        .status,
    ).toBe('FAILED');
  });
  it('fails missing or late report even if values pass', () => {
    expect(evaluateDailyKpis({ hasEligibleReport: false, progress: [progress(true)] }).status).toBe(
      'FAILED',
    );
  });
  it('uses only server-provided exemption source', () => {
    expect(
      evaluateDailyKpis({
        hasEligibleReport: false,
        progress: [progress(false)],
        exemptionSource: 'APPROVED_LEAVE',
      }),
    ).toEqual({
      status: 'EXEMPT',
      failed: [],
      exemptionSource: 'APPROVED_LEAVE',
    });
  });
  it('ignores failed optional KPI', () => {
    expect(
      evaluateDailyKpis({
        hasEligibleReport: true,
        progress: [progress(true), progress(false, false)],
      }).status,
    ).toBe('PASSED');
  });
});
