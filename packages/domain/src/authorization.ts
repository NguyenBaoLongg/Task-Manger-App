export type PermissionCode =
  | 'tenant.read'
  | 'tenant.manage'
  | 'branch.manage'
  | 'organization.manage'
  | 'member.read'
  | 'member.invite'
  | 'member.manage'
  | 'role.read'
  | 'role.manage'
  | 'form.read'
  | 'form.manage'
  | 'form.submit'
  | 'chat.read'
  | 'chat.write'
  | 'chat.manage'
  | 'media.create'
  | 'media.read'
  | 'audit.read'
  | 'kpi.view'
  | 'kpi.configure'
  | 'kpi.target.manage'
  | 'kpi.policy.manage'
  | 'kpi.report.submit'
  | 'kpi.evaluation.view'
  | 'kpi.evaluation.rerun'
  | 'kpi.penalty.adjust'
  | 'attendance.schedule.self'
  | 'attendance.schedule.manage'
  | 'attendance.video-policy.manage'
  | 'attendance.video.review'
  | 'attendance.penalty-policy.manage'
  | 'workflow.configure'
  | 'workflow.decide'
  | 'attendance.leave.manage'
  | 'attendance.off-calendar.manage'
  | 'attendance.penalty.payment.manage'
  | 'attendance.media.legal-hold';

export interface EffectivePermissionBinding {
  permission: PermissionCode;
  scopeType: 'TENANT' | 'BRANCH';
  branchId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface AuthorizationInput {
  tenantId: string;
  membershipId: string;
  membershipStatus: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';
  permission: PermissionCode;
  requestedBranchId?: string;
  bindings: EffectivePermissionBinding[];
  now: Date;
}

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: 'INACTIVE_MEMBERSHIP' | 'PERMISSION_MISSING' | 'SCOPE_MISMATCH' };

export function authorize(input: AuthorizationInput): AuthorizationDecision {
  if (input.membershipStatus !== 'ACTIVE') {
    return { allowed: false, reason: 'INACTIVE_MEMBERSHIP' };
  }

  const active = input.bindings.filter(
    (binding) =>
      binding.permission === input.permission &&
      binding.effectiveFrom <= input.now &&
      (!binding.effectiveTo || binding.effectiveTo > input.now),
  );
  if (active.length === 0) return { allowed: false, reason: 'PERMISSION_MISSING' };
  if (active.some((binding) => binding.scopeType === 'TENANT')) return { allowed: true };
  if (!input.requestedBranchId) return { allowed: false, reason: 'SCOPE_MISMATCH' };
  if (
    active.some(
      (binding) => binding.scopeType === 'BRANCH' && binding.branchId === input.requestedBranchId,
    )
  ) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'SCOPE_MISMATCH' };
}
