import { describe, expect, it } from 'vitest';
import {
  calculateProgress,
  parseExactMetric,
  serializeExactMetric,
  sumExactMetrics,
} from './calculation.js';

describe('KPI exact calculations', () => {
  it('calculates VND without binary floating point', () => {
    const target = parseExactMetric('MONEY', '10000000', 'VND');
    const actual = parseExactMetric('MONEY', '7500000', 'VND');
    const progress = calculateProgress(target, actual, 'AT_LEAST');
    expect(progress.passed).toBe(false);
    expect(serializeExactMetric(progress.remaining)).toBe('2500000');
  });

  it('supports count and AT_MOST', () => {
    const target = parseExactMetric('COUNT', '3', 'task');
    expect(
      calculateProgress(target, parseExactMetric('COUNT', '2', 'task'), 'AT_LEAST').passed,
    ).toBe(false);
    expect(
      calculateProgress(target, parseExactMetric('COUNT', '2', 'task'), 'AT_MOST').passed,
    ).toBe(true);
  });

  it('normalizes percentage to four decimal places exactly', () => {
    const value = parseExactMetric('PERCENTAGE', '99.125', 'PERCENT');
    expect(value.atomic).toBe(991250n);
    expect(serializeExactMetric(value)).toBe('99.125');
  });

  it('treats missing actual as missing rather than a passing zero', () => {
    const target = parseExactMetric('COUNT', '0', 'task');
    expect(calculateProgress(target, null, 'AT_LEAST').passed).toBe(false);
  });

  it('rejects incompatible sums', () => {
    expect(() =>
      sumExactMetrics([
        parseExactMetric('COUNT', '1', 'task'),
        parseExactMetric('COUNT', '1', 'tour'),
      ]),
    ).toThrow(/đơn vị/i);
  });
});
