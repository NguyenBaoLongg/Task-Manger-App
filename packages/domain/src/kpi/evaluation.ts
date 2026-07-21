import type { EvaluationStatus, KpiProgressDetail } from './types.js';

export interface EvaluationDecision {
  status: EvaluationStatus;
  failed: KpiProgressDetail[];
  exemptionSource?: string;
}

export function evaluateDailyKpis(input: {
  hasEligibleReport: boolean;
  progress: KpiProgressDetail[];
  exemptionSource?: string | null;
}): EvaluationDecision {
  if (input.exemptionSource) {
    return { status: 'EXEMPT', failed: [], exemptionSource: input.exemptionSource };
  }
  const failed = input.progress.filter((item) => item.required && !item.passed);
  if (!input.hasEligibleReport)
    return { status: 'FAILED', failed: input.progress.filter((item) => item.required) };
  return { status: failed.length === 0 ? 'PASSED' : 'FAILED', failed };
}
