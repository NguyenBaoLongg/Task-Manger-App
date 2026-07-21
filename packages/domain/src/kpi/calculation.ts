import { ProblemError } from '../foundation.js';
import type { ExactMetricValue, KpiDirection, KpiValueType } from './types.js';

const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.([0-9]{1,4}))?$/;

export function parseExactMetric(
  valueType: KpiValueType,
  value: string,
  unit: string,
): ExactMetricValue {
  if (valueType === 'PERCENTAGE') {
    const match = DECIMAL_PATTERN.exec(value);
    if (!match) throw new ProblemError(422, 'VALIDATION_FAILED', 'Giá trị tỷ lệ không hợp lệ.');
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const [whole, fraction = ''] = unsigned.split('.');
    const atomic = BigInt(whole!) * 10_000n + BigInt(fraction.padEnd(4, '0'));
    return { valueType, atomic: negative ? -atomic : atomic, scale: 4, unit };
  }
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Giá trị số nguyên không hợp lệ.');
  }
  return { valueType, atomic: BigInt(value), scale: 0, unit };
}

export function serializeExactMetric(value: ExactMetricValue): string {
  if (value.scale === 0) return value.atomic.toString();
  const negative = value.atomic < 0n;
  const absolute = negative ? -value.atomic : value.atomic;
  const whole = absolute / 10_000n;
  const fraction = (absolute % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function calculateProgress(
  target: ExactMetricValue,
  actual: ExactMetricValue | null,
  direction: KpiDirection,
): { passed: boolean; remaining: ExactMetricValue } {
  if (actual && (actual.valueType !== target.valueType || actual.unit !== target.unit)) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Đơn vị KPI không tương thích.');
  }
  const actualAtomic = actual?.atomic ?? 0n;
  const passed =
    actual !== null &&
    (direction === 'AT_LEAST' ? actualAtomic >= target.atomic : actualAtomic <= target.atomic);
  const difference =
    direction === 'AT_LEAST' ? target.atomic - actualAtomic : actualAtomic - target.atomic;
  return {
    passed,
    remaining: { ...target, atomic: difference > 0n ? difference : 0n },
  };
}

export function sumExactMetrics(values: ExactMetricValue[]): ExactMetricValue | null {
  const first = values[0];
  if (!first) return null;
  for (const value of values) {
    if (
      value.valueType !== first.valueType ||
      value.unit !== first.unit ||
      value.scale !== first.scale
    ) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Không thể cộng các giá trị khác đơn vị.');
    }
  }
  return { ...first, atomic: values.reduce((sum, value) => sum + value.atomic, 0n) };
}
