import { describe, expect, it } from 'vitest';
import { effectivePenaltyAmount, validatePenaltyAdjustment } from './penalty.js';

describe('penalty adjustment ledger', () => {
  it('preserves the original and applies signed adjustments', () => {
    expect(effectivePenaltyAmount(100_000n, [-20_000n, 5_000n])).toBe(85_000n);
  });
  it('allows full reversal', () => {
    expect(validatePenaltyAdjustment(100_000n, [], -100_000n)).toBe(0n);
  });
  it('rejects negative effective amount and zero delta', () => {
    expect(() => validatePenaltyAdjustment(100_000n, [], -100_001n)).toThrow(/nhỏ hơn 0/i);
    expect(() => validatePenaltyAdjustment(100_000n, [], 0n)).toThrow(/khác 0/i);
  });
});
