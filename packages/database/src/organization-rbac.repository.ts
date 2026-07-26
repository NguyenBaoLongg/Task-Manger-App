import type { DatabaseClient } from './client.js';
import { ProblemError } from '@adsup/domain';
import { decodeTimeCursor, encodeTimeCursor } from './cursor.js';

export class OrganizationRbacRepository {
  constructor(private readonly db: DatabaseClient) {}
  listBranches(tenantId: string) {
    return this.db.branch.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }
  createBranch(data: {
    tenantId: string;
    code: string;
    name: string;
    timezoneOverride?: string;
    createdByMembershipId: string;
  }) {
    return this.db.branch.create({ data });
  }
  listDepartments(tenantId: string) {
    return this.db.department.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }
  createDepartment(data: { tenantId: string; code: string; name: string }) {
    return this.db.department.create({ data });
  }
  listPositions(tenantId: string) {
    return this.db.position.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }
  createPosition(data: { tenantId: string; code: string; name: string }) {
    return this.db.position.create({ data });
  }
  updateBranchStatus(data: LifecycleUpdate) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.branch.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.id } },
      });
      const unit = await tx.branch.update({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.id } },
        data: { status: data.status },
      });
      await tx.auditEvent.create({ data: lifecycleAudit(data, 'BRANCH', before.status) });
      return unit;
    });
  }
  updateDepartmentStatus(data: LifecycleUpdate) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.department.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.id } },
      });
      const unit = await tx.department.update({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.id } },
        data: { status: data.status },
      });
      await tx.auditEvent.create({ data: lifecycleAudit(data, 'DEPARTMENT', before.status) });
      return unit;
    });
  }
  updatePositionStatus(data: LifecycleUpdate) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.position.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.id } },
      });
      const unit = await tx.position.update({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.id } },
        data: { status: data.status },
      });
      await tx.auditEvent.create({ data: lifecycleAudit(data, 'POSITION', before.status) });
      return unit;
    });
  }
  async listMemberships(tenantId: string, cursor?: string, limit = 50) {
    const decoded = decodeTimeCursor(cursor);
    const items = await this.db.tenantMembership.findMany({
      where: {
        tenantId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { gt: decoded.timestamp } },
                { createdAt: decoded.timestamp, id: { gt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(limit, 100) + 1,
    });
    const hasMore = items.length > Math.min(limit, 100);
    if (hasMore) items.pop();
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeTimeCursor(last.createdAt, last.id) : null,
    };
  }
  getMembership(tenantId: string, membershipId: string) {
    return this.db.tenantMembership.findUnique({
      where: { tenantId_id: { tenantId, id: membershipId } },
    });
  }
  updateMembership(
    tenantId: string,
    membershipId: string,
    version: number,
    data: {
      membershipDisplayName?: string;
      employeeCode?: string;
      status?: 'ACTIVE' | 'SUSPENDED' | 'LEFT';
    },
  ) {
    return this.db.tenantMembership.updateMany({
      where: { tenantId, id: membershipId, version },
      data: { ...data, version: { increment: 1 } },
    });
  }
  async updateMembershipWithOwnerGuard(data: {
    tenantId: string;
    membershipId: string;
    actorMembershipId: string;
    displayName?: string;
    employeeCode?: string | null;
    status?: 'ACTIVE' | 'SUSPENDED' | 'LEFT';
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(
      async (tx) => {
        const current = await tx.tenantMembership.findUnique({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.membershipId } },
        });
        if (!current)
          throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy thành viên.');
        if (data.status && data.status !== 'ACTIVE' && current.status === 'ACTIVE') {
          const ownerRole = await tx.role.findUnique({
            where: { tenantId_code: { tenantId: data.tenantId, code: 'TENANT_OWNER' } },
          });
          if (ownerRole) {
            const now = new Date();
            const currentOwner = await tx.membershipRoleBinding.findFirst({
              where: {
                tenantId: data.tenantId,
                membershipId: data.membershipId,
                roleId: ownerRole.id,
                scopeType: 'TENANT',
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
              },
            });
            if (currentOwner) {
              const otherBindings = await tx.membershipRoleBinding.findMany({
                where: {
                  tenantId: data.tenantId,
                  membershipId: { not: data.membershipId },
                  roleId: ownerRole.id,
                  scopeType: 'TENANT',
                  effectiveFrom: { lte: now },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
                },
                select: { membershipId: true },
              });
              const activeOwners = await tx.tenantMembership.count({
                where: {
                  tenantId: data.tenantId,
                  id: { in: otherBindings.map((item) => item.membershipId) },
                  status: 'ACTIVE',
                },
              });
              if (activeOwners === 0)
                throw new ProblemError(
                  409,
                  'LAST_OWNER_REQUIRED',
                  'Doanh nghiệp phải còn ít nhất một chủ doanh nghiệp hoạt động.',
                );
            }
          }
        }
        const updated = await tx.tenantMembership.update({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.membershipId } },
          data: {
            membershipDisplayName: data.displayName,
            employeeCode: data.employeeCode,
            status: data.status,
            suspendedAt: data.status === 'SUSPENDED' ? new Date() : undefined,
            leftAt: data.status === 'LEFT' ? new Date() : undefined,
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: data.tenantId,
            actorMembershipId: data.actorMembershipId,
            correlationId: data.correlationId,
            eventType: 'MEMBERSHIP_UPDATED',
            targetType: 'TENANT_MEMBERSHIP',
            targetId: data.membershipId,
            reason: data.reason,
            beforeRedacted: {
              displayName: current.membershipDisplayName,
              employeeCode: current.employeeCode,
              status: current.status,
              version: current.version,
            },
            afterRedacted: {
              displayName: updated.membershipDisplayName,
              employeeCode: updated.employeeCode,
              status: updated.status,
              version: updated.version,
            },
          },
        });
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  createAssignment(data: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    departmentId?: string;
    positionId?: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
    createdByMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(
      async (tx) => {
        // Interactive transactions use one checked-out pg client; keep queries sequential.
        const membership = await tx.tenantMembership.findUnique({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.membershipId } },
        });
        const branch = await tx.branch.findUnique({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.branchId } },
        });
        const department = data.departmentId
          ? await tx.department.findUnique({
              where: { tenantId_id: { tenantId: data.tenantId, id: data.departmentId } },
            })
          : null;
        const position = data.positionId
          ? await tx.position.findUnique({
              where: { tenantId_id: { tenantId: data.tenantId, id: data.positionId } },
            })
          : null;
        if (
          !membership ||
          membership.status !== 'ACTIVE' ||
          !branch ||
          branch.status !== 'ACTIVE' ||
          (data.departmentId && (!department || department.status !== 'ACTIVE')) ||
          (data.positionId && (!position || position.status !== 'ACTIVE'))
        )
          throw new ProblemError(
            409,
            'CONFLICT',
            'Thành viên hoặc đơn vị phân công không còn hoạt động.',
          );
        const overlapping = await tx.assignment.findFirst({
          where: {
            tenantId: data.tenantId,
            membershipId: data.membershipId,
            status: 'ACTIVE',
            effectiveFrom: data.effectiveTo ? { lt: data.effectiveTo } : undefined,
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: data.effectiveFrom } }],
          },
          select: { id: true },
        });
        if (overlapping) {
          throw new ProblemError(
            409,
            'BUSINESS_RULE_VIOLATION',
            'Nhân viên chỉ được có một phân công cơ sở trong cùng thời gian.',
          );
        }
        const assignment = await tx.assignment.create({
          data: {
            tenantId: data.tenantId,
            membershipId: data.membershipId,
            branchId: data.branchId,
            departmentId: data.departmentId,
            positionId: data.positionId,
            effectiveFrom: data.effectiveFrom,
            effectiveTo: data.effectiveTo,
            createdByMembershipId: data.createdByMembershipId,
            reason: data.reason,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: data.tenantId,
            actorMembershipId: data.createdByMembershipId,
            correlationId: data.correlationId,
            eventType: 'ASSIGNMENT_CREATED',
            targetType: 'ASSIGNMENT',
            targetId: assignment.id,
            reason: data.reason,
            afterRedacted: {
              membershipId: assignment.membershipId,
              branchId: assignment.branchId,
              departmentId: assignment.departmentId,
              positionId: assignment.positionId,
              effectiveFrom: assignment.effectiveFrom.toISOString(),
              effectiveTo: assignment.effectiveTo?.toISOString(),
            },
          },
        });
        return assignment;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  listAssignments(data: {
    tenantId: string;
    membershipId: string;
    at?: Date;
    includeHistory?: boolean;
  }) {
    const at = data.at ?? new Date();
    return this.db.assignment.findMany({
      where: {
        tenantId: data.tenantId,
        membershipId: data.membershipId,
        ...(data.includeHistory
          ? {}
          : {
              status: 'ACTIVE',
              effectiveFrom: { lte: at },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            }),
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
  }
  async listRoles(tenantId: string) {
    const roles = await this.db.role.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
    const bindings = await this.db.rolePermission.findMany({
      where: { tenantId, roleId: { in: roles.map((role) => role.id) } },
    });
    const permissions = await this.db.permission.findMany({
      where: { id: { in: bindings.map((binding) => binding.permissionId) } },
      select: { id: true, code: true },
    });
    const codeById = new Map(permissions.map((permission) => [permission.id, permission.code]));
    return roles.map((role) => ({
      ...role,
      permissionCodes: bindings
        .filter((binding) => binding.roleId === role.id)
        .map((binding) => codeById.get(binding.permissionId))
        .filter((code): code is string => Boolean(code))
        .sort(),
    }));
  }
  createRole(data: {
    tenantId: string;
    code: string;
    name: string;
    permissionCodes: string[];
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: { code: { in: data.permissionCodes } },
        select: { id: true, code: true },
      });
      if (permissions.length !== new Set(data.permissionCodes).size)
        throw new ProblemError(422, 'VALIDATION_FAILED', 'Có permission code không được công bố.');
      const role = await tx.role.create({
        data: { tenantId: data.tenantId, code: data.code, name: data.name, kind: 'CUSTOM' },
      });
      if (permissions.length)
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            tenantId: data.tenantId,
            roleId: role.id,
            permissionId: permission.id,
          })),
        });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.actorMembershipId,
          correlationId: data.correlationId,
          eventType: 'ROLE_CREATED',
          targetType: 'ROLE',
          targetId: role.id,
          reason: data.reason,
          afterRedacted: {
            code: role.code,
            name: role.name,
            permissionCodes: data.permissionCodes,
          },
        },
      });
      return { ...role, permissionCodes: permissions.map((permission) => permission.code).sort() };
    });
  }
  grantBinding(data: {
    tenantId: string;
    membershipId: string;
    roleId: string;
    scopeType: 'TENANT' | 'BRANCH';
    branchId?: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
    grantedByMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findUnique({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.membershipId } },
      });
      const role = await tx.role.findUnique({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.roleId } },
      });
      const branch = data.branchId
        ? await tx.branch.findUnique({
            where: { tenantId_id: { tenantId: data.tenantId, id: data.branchId } },
          })
        : null;
      if (
        !membership ||
        membership.status !== 'ACTIVE' ||
        !role ||
        (data.branchId && (!branch || branch.status !== 'ACTIVE'))
      )
        throw new ProblemError(
          409,
          'CONFLICT',
          'Thành viên, vai trò hoặc phạm vi cấp quyền không còn hoạt động.',
        );
      const binding = await tx.membershipRoleBinding.create({
        data: {
          tenantId: data.tenantId,
          membershipId: data.membershipId,
          roleId: data.roleId,
          scopeType: data.scopeType,
          branchId: data.branchId,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
          grantedByMembershipId: data.grantedByMembershipId,
          reason: data.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.grantedByMembershipId,
          correlationId: data.correlationId,
          eventType: 'ROLE_BINDING_GRANTED',
          targetType: 'MEMBERSHIP_ROLE_BINDING',
          targetId: binding.id,
          reason: data.reason,
          afterRedacted: {
            membershipId: binding.membershipId,
            roleId: binding.roleId,
            scopeType: binding.scopeType,
            branchId: binding.branchId,
            effectiveFrom: binding.effectiveFrom.toISOString(),
            effectiveTo: binding.effectiveTo?.toISOString(),
          },
        },
      });
      return binding;
    });
  }
  async isActiveOwner(tenantId: string, membershipId: string, now: Date) {
    const role = await this.db.role.findUnique({
      where: { tenantId_code: { tenantId, code: 'TENANT_OWNER' } },
    });
    if (!role) return false;
    return Boolean(
      await this.db.membershipRoleBinding.findFirst({
        where: {
          tenantId,
          membershipId,
          roleId: role.id,
          scopeType: 'TENANT',
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
      }),
    );
  }
  async countOtherActiveOwners(tenantId: string, excludedMembershipId: string, now: Date) {
    const role = await this.db.role.findUnique({
      where: { tenantId_code: { tenantId, code: 'TENANT_OWNER' } },
    });
    if (!role) return 0;
    return this.db.membershipRoleBinding.count({
      where: {
        tenantId,
        membershipId: { not: excludedMembershipId },
        scopeType: 'TENANT',
        roleId: role.id,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    });
  }
  listPermissionBindings(tenantId: string, membershipId: string) {
    return this.db.membershipRoleBinding.findMany({
      where: { tenantId, membershipId },
      orderBy: { effectiveFrom: 'asc' },
    });
  }
  async hasPermission(tenantId: string, membershipId: string, code: string, branchId?: string) {
    const permission = await this.db.permission.findUnique({ where: { code } });
    if (!permission) return false;
    const rolePermissions = await this.db.rolePermission.findMany({
      where: { tenantId, permissionId: permission.id },
      select: { roleId: true },
    });
    if (!rolePermissions.length) return false;
    const now = new Date();
    return Boolean(
      await this.db.membershipRoleBinding.findFirst({
        where: {
          tenantId,
          membershipId,
          roleId: { in: rolePermissions.map((item) => item.roleId) },
          effectiveFrom: { lte: now },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
            branchId
              ? { OR: [{ scopeType: 'TENANT' }, { scopeType: 'BRANCH', branchId }] }
              : { scopeType: 'TENANT' },
          ],
        },
      }),
    );
  }

  async hasAnyPermission(tenantId: string, membershipId: string, code: string) {
    const permission = await this.db.permission.findUnique({ where: { code } });
    if (!permission) return false;
    const rolePermissions = await this.db.rolePermission.findMany({
      where: { tenantId, permissionId: permission.id },
      select: { roleId: true },
    });
    if (!rolePermissions.length) return false;
    const now = new Date();
    return Boolean(
      await this.db.membershipRoleBinding.findFirst({
        where: {
          tenantId,
          membershipId,
          roleId: { in: rolePermissions.map((item) => item.roleId) },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
      }),
    );
  }

  async resolvePermissionScope(tenantId: string, membershipId: string, code: string) {
    const permission = await this.db.permission.findUnique({ where: { code } });
    if (!permission) return { tenantWide: false, branchIds: [] };
    const rolePermissions = await this.db.rolePermission.findMany({
      where: { tenantId, permissionId: permission.id },
      select: { roleId: true },
    });
    if (rolePermissions.length === 0) return { tenantWide: false, branchIds: [] };
    const now = new Date();
    const bindings = await this.db.membershipRoleBinding.findMany({
      where: {
        tenantId,
        membershipId,
        roleId: { in: rolePermissions.map((item) => item.roleId) },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      select: { scopeType: true, branchId: true },
    });
    return {
      tenantWide: bindings.some((binding) => binding.scopeType === 'TENANT'),
      branchIds: [
        ...new Set(
          bindings
            .filter((binding) => binding.scopeType === 'BRANCH' && binding.branchId)
            .map((binding) => binding.branchId as string),
        ),
      ].sort(),
    };
  }
}

interface LifecycleUpdate {
  tenantId: string;
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  actorMembershipId: string;
  reason: string;
  correlationId: string;
}

function lifecycleAudit(data: LifecycleUpdate, targetType: string, beforeStatus: string) {
  return {
    tenantId: data.tenantId,
    actorMembershipId: data.actorMembershipId,
    correlationId: data.correlationId,
    eventType: `${targetType}_STATUS_CHANGED`,
    targetType,
    targetId: data.id,
    reason: data.reason,
    beforeRedacted: { status: beforeStatus },
    afterRedacted: { status: data.status },
  };
}
