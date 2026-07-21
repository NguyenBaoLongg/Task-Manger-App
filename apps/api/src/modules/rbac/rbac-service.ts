import { ProblemError } from '@adsup/domain';
import type {
  MembershipRoleBinding,
  OrganizationRbacRepository,
  TenantMembership,
} from '@adsup/database';

export class RbacService {
  constructor(private readonly repository: OrganizationRbacRepository) {}
  listMemberships(tenantId: string, cursor?: string) {
    return this.repository.listMemberships(tenantId, cursor);
  }
  listRoles(tenantId: string) {
    return this.repository.listRoles(tenantId);
  }
  createRole(input: {
    tenantId: string;
    code: string;
    name: string;
    permissionCodes: string[];
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.repository.createRole({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
    });
  }
  async updateMembership(input: {
    tenantId: string;
    membershipId: string;
    displayName?: string;
    employeeCode?: string | null;
    status?: 'ACTIVE' | 'SUSPENDED' | 'LEFT';
    reason: string;
    actorMembershipId: string;
    correlationId: string;
  }): Promise<TenantMembership> {
    return this.repository.updateMembershipWithOwnerGuard(input);
  }
  grantBinding(input: {
    tenantId: string;
    membershipId: string;
    roleId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }): Promise<MembershipRoleBinding> {
    if ((input.scopeType === 'BRANCH') !== Boolean(input.branchId))
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Phạm vi cơ sở không hợp lệ.');
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Ngày kết thúc phải sau ngày bắt đầu.');
    return this.repository.grantBinding({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      roleId: input.roleId,
      scopeType: input.scopeType,
      branchId: input.branchId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      grantedByMembershipId: input.actorMembershipId,
      reason: input.reason,
      correlationId: input.correlationId,
    });
  }
}
