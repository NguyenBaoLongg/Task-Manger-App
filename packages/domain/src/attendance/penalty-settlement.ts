import type { ViolationKind } from './types.js';

export interface PenaltyComponentInput {
  kind: ViolationKind;
  amountMinor: bigint;
  independent: boolean;
  sourceId?: string;
}

export interface PenaltyComponentSnapshot extends PenaltyComponentInput {
  suppressed: boolean;
  suppressionReason?: 'MAX_OF_VIDEO_AND_LATE';
}

export function settlePenaltyComponents(components: PenaltyComponentInput[]) {
  const snapshots: PenaltyComponentSnapshot[] = components.map((component) => ({
    ...component,
    suppressed: false,
  }));
  const video = snapshots.find((component) => component.kind === 'VIDEO_STANDARD_FAILED');
  const late = snapshots.find((component) => component.kind === 'LATE_BASE');
  if (video && late) {
    const suppressed = video.amountMinor >= late.amountMinor ? late : video;
    suppressed.suppressed = true;
    suppressed.suppressionReason = 'MAX_OF_VIDEO_AND_LATE';
  }
  const baseAmountMinor = snapshots
    .filter((component) => !component.independent && !component.suppressed)
    .reduce((sum, component) => sum + component.amountMinor, 0n);
  const independentAmountMinor = snapshots
    .filter((component) => component.independent && !component.suppressed)
    .reduce((sum, component) => sum + component.amountMinor, 0n);
  const suppressedAmountMinor = snapshots
    .filter((component) => component.suppressed)
    .reduce((sum, component) => sum + component.amountMinor, 0n);
  return {
    baseAmountMinor,
    independentAmountMinor,
    suppressedAmountMinor,
    totalAmountMinor: baseAmountMinor + independentAmountMinor,
    components: snapshots,
  };
}
