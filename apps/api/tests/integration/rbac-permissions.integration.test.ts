import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  OrganizationRbacRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { RbacService } from '../../src/modules/rbac/rbac-service.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

interface RbacLiveTenant {
  tenantId: string;
  userId: string;
  membershipId: string;
}

async function ensurePermission(db: DatabaseClient, code: string) {
  await db.permission.upsert({
    where: { code },
    update: {},
    create: { code, description: code, allowedScopes: ['TENANT'] },
  });
  return (await db.permission.findUniqueOrThrow({ where: { code } })).id;
}

async function createRbacLiveTenant(db: DatabaseClient): Promise<RbacLiveTenant> {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  await db.user.create({
    data: { id: userId, fullName: 'Rbac Live User', fullNameConfirmedAt: new Date() },
  });
  await db.tenant.create({
    data: {
      id: tenantId,
      name: 'Rbac Live Fixture',
      slug: `rbac-live-${tenantId.slice(0, 8)}`,
      createdByUserId: userId,
    },
  });
  await db.tenantMembership.create({
    data: {
      tenantId,
      id: membershipId,
      userId,
      membershipDisplayName: 'Owner',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
  return { tenantId, userId, membershipId };
}

async function cleanupRbacLiveTenant(db: DatabaseClient, tenant: RbacLiveTenant) {
  await db.membershipRoleBinding.deleteMany({ where: { tenantId: tenant.tenantId } });
  await db.rolePermission.deleteMany({ where: { tenantId: tenant.tenantId } });
  await db.role.deleteMany({ where: { tenantId: tenant.tenantId } });
  await db.tenantMembership.deleteMany({ where: { tenantId: tenant.tenantId } });
  await db.tenant.delete({ where: { id: tenant.tenantId } });
  await db.user.delete({ where: { id: tenant.userId } });
}

live('rbac my-permissions tenant isolation', () => {
  let db: DatabaseClient;
  let service: RbacService;
  let tenantA: RbacLiveTenant;
  let tenantB: RbacLiveTenant;
  let invitePermissionId: string;
  let roleReadPermissionId: string;

  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    service = new RbacService(new OrganizationRbacRepository(db));
    tenantA = await createRbacLiveTenant(db);
    tenantB = await createRbacLiveTenant(db);
    invitePermissionId = await ensurePermission(db, 'member.invite');
    roleReadPermissionId = await ensurePermission(db, 'role.read');
  });
  afterAll(async () => {
    await cleanupRbacLiveTenant(db, tenantB);
    await cleanupRbacLiveTenant(db, tenantA);
    await db.$disconnect();
  });

  async function grantRole(input: {
    tenantId: string;
    membershipId: string;
    permissionId: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const roleId = randomUUID();
    await db.role.create({
      data: {
        tenantId: input.tenantId,
        id: roleId,
        code: `RBAC_LIVE_${roleId.slice(0, 8)}`,
        name: 'Rbac Live Role',
        kind: 'CUSTOM',
      },
    });
    await db.rolePermission.create({
      data: { tenantId: input.tenantId, roleId, permissionId: input.permissionId },
    });
    await db.membershipRoleBinding.create({
      data: {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        roleId,
        scopeType: 'TENANT',
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        grantedByMembershipId: input.membershipId,
        reason: 'Rbac live test',
      },
    });
  }

  it('returns member.invite for an actively bound member', async () => {
    await grantRole({
      tenantId: tenantA.tenantId,
      membershipId: tenantA.membershipId,
      permissionId: invitePermissionId,
      effectiveFrom: new Date(Date.now() - 60_000),
    });
    const codes = await service.myPermissionCodes(tenantA.tenantId, tenantA.membershipId);
    expect(codes).toContain('member.invite');
  });

  it('returns nothing when a tenant A membership is queried against tenant B', async () => {
    await grantRole({
      tenantId: tenantB.tenantId,
      membershipId: tenantB.membershipId,
      permissionId: invitePermissionId,
      effectiveFrom: new Date(Date.now() - 60_000),
    });
    const codes = await service.myPermissionCodes(tenantB.tenantId, tenantA.membershipId);
    expect(codes).toEqual([]);
  });

  it('excludes bindings outside their effective window', async () => {
    await grantRole({
      tenantId: tenantA.tenantId,
      membershipId: tenantA.membershipId,
      permissionId: roleReadPermissionId,
      effectiveFrom: new Date(Date.now() + 3_600_000),
    });
    await grantRole({
      tenantId: tenantA.tenantId,
      membershipId: tenantA.membershipId,
      permissionId: roleReadPermissionId,
      effectiveFrom: new Date(Date.now() - 7_200_000),
      effectiveTo: new Date(Date.now() - 3_600_000),
    });
    const codes = await service.myPermissionCodes(tenantA.tenantId, tenantA.membershipId);
    expect(codes).toContain('member.invite');
    expect(codes).not.toContain('role.read');
  });

  it('returns empty for a member with no bindings', async () => {
    await expect(service.myPermissionCodes(tenantB.tenantId, randomUUID())).resolves.toEqual([]);
  });
});
