import type { EffectiveAssignment } from './types.js';

export type BranchResolution =
  | { ok: true; branchId: string; assignmentId?: string }
  | { ok: false; code: 'NO_ACTIVE_BRANCH' | 'MULTIPLE_ACTIVE_BRANCHES'; count: number };

export function resolveSoleCurrentBranch(
  assignments: Array<EffectiveAssignment & { id?: string }>,
  instant: Date,
): BranchResolution {
  const active = assignments.filter(
    (assignment) =>
      assignment.status === 'ACTIVE' &&
      assignment.effectiveFrom <= instant &&
      (!assignment.effectiveTo || assignment.effectiveTo > instant),
  );
  if (active.length === 0) return { ok: false, code: 'NO_ACTIVE_BRANCH', count: 0 };
  const branchIds = [...new Set(active.map((assignment) => assignment.branchId))];
  if (branchIds.length !== 1) {
    return { ok: false, code: 'MULTIPLE_ACTIVE_BRANCHES', count: branchIds.length };
  }
  return { ok: true, branchId: branchIds[0]!, assignmentId: active[0]?.id };
}
