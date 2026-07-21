import { describe, expect, it } from 'vitest';
import { settlePenaltyComponents } from './penalty-settlement.js';

describe('attendance penalty settlement rules', () => {
  it('keeps the higher of video and late base while adding independent no-notice surcharges', () => {
    const settlement = settlePenaltyComponents([
      { kind: 'VIDEO_STANDARD_FAILED', amountMinor: 50_000n, independent: false },
      { kind: 'LATE_BASE', amountMinor: 20_000n, independent: false },
      { kind: 'LATE_NO_NOTICE', amountMinor: 100_000n, independent: true },
    ]);
    expect(settlement.baseAmountMinor).toBe(50_000n);
    expect(settlement.independentAmountMinor).toBe(100_000n);
    expect(settlement.suppressedAmountMinor).toBe(20_000n);
    expect(settlement.totalAmountMinor).toBe(150_000n);
    expect(settlement.components.find((item) => item.kind === 'LATE_BASE')).toMatchObject({
      suppressed: true,
      suppressionReason: 'MAX_OF_VIDEO_AND_LATE',
    });
  });

  it('does not suppress leave and sudden-leave violations because they are independent', () => {
    const settlement = settlePenaltyComponents([
      { kind: 'SUDDEN_LEAVE_NO_NOTICE', amountMinor: 50_000n, independent: true },
      { kind: 'SUDDEN_LEAVE_OVER_LIMIT', amountMinor: 100_000n, independent: true },
    ]);
    expect(settlement.totalAmountMinor).toBe(150_000n);
    expect(settlement.suppressedAmountMinor).toBe(0n);
  });
});
