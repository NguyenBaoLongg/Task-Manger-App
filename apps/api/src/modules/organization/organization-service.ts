import { randomUUID } from 'node:crypto';
import { ProblemError } from '@adsup/domain';
import type {
  Assignment,
  Branch,
  Department,
  OrganizationRbacRepository,
  Position,
} from '@adsup/database';

export class OrganizationService {
  constructor(private readonly repository: OrganizationRbacRepository) {}
  listBranches(tenantId: string): Promise<Branch[]> {
    return this.repository.listBranches(tenantId);
  }
  async createBranch(input: {
    tenantId: string;
    code: string;
    name: string;
    timezoneOverride?: string;
    actorMembershipId: string;
    correlationId?: string;
  }): Promise<Branch> {
    const branch = await this.repository.createBranch({
      tenantId: input.tenantId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      timezoneOverride: input.timezoneOverride,
      createdByMembershipId: input.actorMembershipId,
    });
    // The first branch of a tenant is created by its owner during onboarding. Auto-assign the
    // creator so KPI scoping (resolveSoleCurrentBranch) does not dead-end with "no active branch".
    const otherActive = (await this.repository.listBranches(input.tenantId)).filter(
      (item) => item.id !== branch.id && item.status === 'ACTIVE',
    );
    if (otherActive.length === 0) {
      await this.repository.createAssignment({
        tenantId: input.tenantId,
        membershipId: input.actorMembershipId,
        branchId: branch.id,
        effectiveFrom: new Date(),
        createdByMembershipId: input.actorMembershipId,
        reason: 'BRANCH_CREATED_BY_MEMBER',
        correlationId: input.correlationId ?? randomUUID(),
      });
    }
    return branch;
  }
  listDepartments(tenantId: string): Promise<Department[]> {
    return this.repository.listDepartments(tenantId);
  }
  createDepartment(input: { tenantId: string; code: string; name: string }): Promise<Department> {
    return this.repository.createDepartment({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
    });
  }
  listPositions(tenantId: string): Promise<Position[]> {
    return this.repository.listPositions(tenantId);
  }
  createPosition(input: { tenantId: string; code: string; name: string }): Promise<Position> {
    return this.repository.createPosition({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
    });
  }
  updateBranchStatus(input: LifecycleInput): Promise<Branch> {
    return this.repository.updateBranchStatus(input);
  }
  updateDepartmentStatus(input: LifecycleInput): Promise<Department> {
    return this.repository.updateDepartmentStatus(input);
  }
  updatePositionStatus(input: LifecycleInput): Promise<Position> {
    return this.repository.updatePositionStatus(input);
  }
  listAssignments(input: {
    tenantId: string;
    membershipId: string;
    at?: Date;
    includeHistory?: boolean;
  }): Promise<Assignment[]> {
    return this.repository.listAssignments(input);
  }
  createAssignment(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    departmentId?: string;
    positionId?: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }): Promise<Assignment> {
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Ngày kết thúc phải sau ngày bắt đầu.');
    return this.repository.createAssignment({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: input.branchId,
      departmentId: input.departmentId,
      positionId: input.positionId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdByMembershipId: input.actorMembershipId,
      reason: input.reason,
      correlationId: input.correlationId,
    });
  }
}

interface LifecycleInput {
  tenantId: string;
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  actorMembershipId: string;
  reason: string;
  correlationId: string;
}
