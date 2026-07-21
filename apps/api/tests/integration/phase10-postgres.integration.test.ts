import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AuthTenantsRepository,
  ChatNotificationsRepository,
  FormsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { TokenService } from '../../src/modules/auth/token-service.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('Phase 10 PostgreSQL regressions', () => {
  let db: DatabaseClient;
  const tenantId = randomUUID();
  const ownerUserId = randomUUID();
  const employeeUserId = randomUUID();
  const ownerMembershipId = randomUUID();
  const employeeMembershipId = randomUUID();
  const ownerRoleId = randomUUID();
  const employeeRoleId = randomUUID();
  const branchId = randomUUID();
  const departmentId = randomUUID();
  const positionId = randomUUID();

  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    await db.permission.upsert({
      where: { code: 'tenant.read' },
      update: {},
      create: {
        code: 'tenant.read',
        description: 'Read tenant',
        allowedScopes: ['TENANT'],
      },
    });
    await db.user.createMany({
      data: [
        { id: ownerUserId, fullName: 'Phase Ten Owner', fullNameConfirmedAt: new Date() },
        { id: employeeUserId, fullName: 'Phase Ten Employee', fullNameConfirmedAt: new Date() },
      ],
    });
    await db.tenant.create({
      data: {
        id: tenantId,
        name: 'Phase Ten Tenant',
        slug: `phase-ten-${tenantId.slice(0, 8)}`,
        createdByUserId: ownerUserId,
      },
    });
    await db.tenantMembership.createMany({
      data: [
        {
          tenantId,
          id: ownerMembershipId,
          userId: ownerUserId,
          membershipDisplayName: 'Phase Ten Owner',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        {
          tenantId,
          id: employeeMembershipId,
          userId: employeeUserId,
          membershipDisplayName: 'Phase Ten Employee',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      ],
    });
    await db.role.createMany({
      data: [
        { tenantId, id: ownerRoleId, code: 'TENANT_OWNER', name: 'Owner', kind: 'SYSTEM' },
        { tenantId, id: employeeRoleId, code: 'EMPLOYEE', name: 'Employee', kind: 'SYSTEM' },
      ],
    });
    await db.membershipRoleBinding.create({
      data: {
        tenantId,
        membershipId: ownerMembershipId,
        roleId: ownerRoleId,
        scopeType: 'TENANT',
        effectiveFrom: new Date(),
        grantedByMembershipId: ownerMembershipId,
      },
    });
    await db.branch.create({
      data: {
        tenantId,
        id: branchId,
        code: 'CLINIC',
        name: 'Clinic',
        createdByMembershipId: ownerMembershipId,
      },
    });
    await db.department.create({
      data: { tenantId, id: departmentId, code: 'SALES', name: 'Sales' },
    });
    await db.position.create({
      data: { tenantId, id: positionId, code: 'STAFF', name: 'Staff' },
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.formTemplate.updateMany({
      where: { tenantId },
      data: { currentPublishedVersionId: null },
    });
    await db.auditEvent.deleteMany({ where: { tenantId } });
    await db.tenantIdempotencyRecord.deleteMany({ where: { tenantId } });
    await db.invitationAcceptance.deleteMany({ where: { tenantId } });
    await db.invitation.deleteMany({ where: { tenantId } });
    await db.chatMessage.deleteMany({ where: { tenantId } });
    await db.chatChannelMembership.deleteMany({ where: { tenantId } });
    await db.chatChannel.deleteMany({ where: { tenantId } });
    await db.formSubmission.deleteMany({ where: { tenantId } });
    await db.formVersion.deleteMany({ where: { tenantId } });
    await db.formTemplate.deleteMany({ where: { tenantId } });
    await db.notificationEndpoint.deleteMany({
      where: { userId: { in: [ownerUserId, employeeUserId] } },
    });
    await db.accountIdempotencyRecord.deleteMany({
      where: { userId: { in: [ownerUserId, employeeUserId] } },
    });
    await db.authSession.deleteMany({
      where: { userId: { in: [ownerUserId, employeeUserId] } },
    });
    await db.rolePermission.deleteMany({ where: { tenantId } });
    await db.membershipRoleBinding.deleteMany({ where: { tenantId } });
    await db.assignment.deleteMany({ where: { tenantId } });
    await db.branch.deleteMany({ where: { tenantId } });
    await db.department.deleteMany({ where: { tenantId } });
    await db.position.deleteMany({ where: { tenantId } });
    await db.role.deleteMany({ where: { tenantId } });
    await db.tenantMembership.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.securityEvent.deleteMany({
      where: { userId: { in: [ownerUserId, employeeUserId] } },
    });
    await db.user.deleteMany({ where: { id: { in: [ownerUserId, employeeUserId] } } });
    await db.$disconnect();
  });

  it('preserves sample seed counts and the appended permission catalog', async () => {
    const sample = await db.tenant.findUniqueOrThrow({ where: { slug: 'cong-ty-tnhh-abc' } });
    expect(sample.name).toBe('Công ty TNHH ABC');
    const counts = [];
    counts.push(await db.tenantMembership.count({ where: { tenantId: sample.id } }));
    counts.push(await db.branch.count({ where: { tenantId: sample.id } }));
    counts.push(await db.department.count({ where: { tenantId: sample.id } }));
    counts.push(await db.position.count({ where: { tenantId: sample.id } }));
    counts.push(await db.role.count({ where: { tenantId: sample.id } }));
    counts.push(await db.assignment.count({ where: { tenantId: sample.id } }));
    counts.push(await db.membershipRoleBinding.count({ where: { tenantId: sample.id } }));
    counts.push(
      await db.chatChannel.count({ where: { tenantId: sample.id, type: 'TENANT_GENERAL' } }),
    );
    expect(counts).toEqual([30, 3, 4, 3, 3, 30, 30, 1]);
    expect(await db.permission.findUnique({ where: { code: 'tenant.manage' } })).not.toBeNull();
  });

  it('audits lifecycle reasons, filters effective assignments and rejects inactive units', async () => {
    const organization = new OrganizationRbacRepository(db);
    await organization.updateBranchStatus({
      tenantId,
      id: branchId,
      status: 'INACTIVE',
      actorMembershipId: ownerMembershipId,
      reason: 'Temporarily close clinic',
      correlationId: 'phase10-branch-inactive',
    });
    await expect(
      organization.createAssignment({
        tenantId,
        membershipId: employeeMembershipId,
        branchId,
        departmentId,
        positionId,
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByMembershipId: ownerMembershipId,
        reason: 'Must reject inactive unit',
        correlationId: 'phase10-assignment-reject',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await organization.updateBranchStatus({
      tenantId,
      id: branchId,
      status: 'ACTIVE',
      actorMembershipId: ownerMembershipId,
      reason: 'Reopen clinic',
      correlationId: 'phase10-branch-active',
    });
    const assignment = await organization.createAssignment({
      tenantId,
      membershipId: employeeMembershipId,
      branchId,
      departmentId,
      positionId,
      effectiveFrom: new Date(Date.now() - 60_000),
      effectiveTo: new Date(Date.now() + 60_000),
      createdByMembershipId: ownerMembershipId,
      reason: 'Assign employee to clinic',
      correlationId: 'phase10-assignment-create',
    });
    expect(
      await organization.listAssignments({ tenantId, membershipId: employeeMembershipId }),
    ).toEqual([expect.objectContaining({ id: assignment.id })]);
    expect(
      await organization.listAssignments({
        tenantId,
        membershipId: employeeMembershipId,
        at: new Date(Date.now() + 120_000),
      }),
    ).toEqual([]);
    expect(
      await organization.listAssignments({
        tenantId,
        membershipId: employeeMembershipId,
        includeHistory: true,
      }),
    ).toHaveLength(1);
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { tenantId, correlationId: 'phase10-branch-inactive' },
    });
    expect(audit).toMatchObject({
      reason: 'Temporarily close clinic',
      beforeRedacted: { status: 'ACTIVE' },
      afterRedacted: { status: 'INACTIVE' },
    });
  });

  it('maps custom roles to published permission codes', async () => {
    const repository = new OrganizationRbacRepository(db);
    const role = await repository.createRole({
      tenantId,
      code: 'CUSTOM_READER',
      name: 'Custom reader',
      permissionCodes: ['tenant.read'],
      actorMembershipId: ownerMembershipId,
      reason: 'Create a least-privilege role',
      correlationId: 'phase10-role-create',
    });
    expect(role.permissionCodes).toEqual(['tenant.read']);
    expect(await repository.listRoles(tenantId)).toContainEqual(
      expect.objectContaining({ id: role.id, permissionCodes: ['tenant.read'] }),
    );
    await expect(
      repository.createRole({
        tenantId,
        code: 'UNKNOWN_PERMISSION',
        name: 'Invalid role',
        permissionCodes: ['permission.not-published'],
        actorMembershipId: ownerMembershipId,
        reason: 'Must reject unknown permissions',
        correlationId: 'phase10-role-reject',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('persists channel membership atomically and selects only active notification endpoints', async () => {
    const repository = new ChatNotificationsRepository(db);
    const channel = await repository.createChannel({
      tenantId,
      type: 'GROUP',
      name: 'Phase ten group',
      membershipIds: [employeeMembershipId],
      createdByMembershipId: ownerMembershipId,
    });
    expect(
      await db.chatChannelMembership.findMany({
        where: { tenantId, channelId: channel.id },
        orderBy: { membershipId: 'asc' },
        select: { membershipId: true, role: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { membershipId: ownerMembershipId, role: 'MODERATOR' },
        { membershipId: employeeMembershipId, role: 'MEMBER' },
      ]),
    );
    const priorCount = await db.chatChannel.count({ where: { tenantId } });
    await expect(
      repository.createChannel({
        tenantId,
        type: 'GROUP',
        name: 'Invalid group',
        membershipIds: [randomUUID()],
        createdByMembershipId: ownerMembershipId,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(await db.chatChannel.count({ where: { tenantId } })).toBe(priorCount);

    const active = await repository.registerEndpoint({
      userId: ownerUserId,
      platform: 'ANDROID',
      provider: 'FCM',
      tokenCiphertext: 'encrypted-active',
      tokenFingerprint: 'active-fingerprint',
    });
    const revoked = await repository.registerEndpoint({
      userId: ownerUserId,
      platform: 'IOS',
      provider: 'APNS',
      tokenCiphertext: 'encrypted-revoked',
      tokenFingerprint: 'revoked-fingerprint',
    });
    const old = new Date('2026-01-01T00:00:00Z');
    await db.notificationEndpoint.update({ where: { id: active.id }, data: { lastSeenAt: old } });
    await repository.revokeEndpoint(ownerUserId, revoked.id);
    expect(await repository.selectActiveEndpoints([ownerUserId])).toEqual([
      expect.objectContaining({ id: active.id, status: 'ACTIVE' }),
    ]);
    const refreshed = await db.notificationEndpoint.findUniqueOrThrow({ where: { id: active.id } });
    expect(refreshed.lastSeenAt!.getTime()).toBeGreaterThan(old.getTime());
  });

  it('retires immutable form versions, archives templates and retains audited history', async () => {
    const repository = new FormsRepository(db);
    const template = await repository.createTemplate({
      tenantId,
      code: 'PHASE10',
      name: 'Phase ten form',
      createdByMembershipId: ownerMembershipId,
      correlationId: 'phase10-form-create',
    });
    const published = await repository.publish({
      tenantId,
      templateId: template.id,
      jsonSchema: { type: 'object', additionalProperties: false },
      actorMembershipId: ownerMembershipId,
      effectiveFrom: new Date(),
      correlationId: 'phase10-form-publish',
      reason: 'Publish approved schema',
    });
    const retired = await repository.retireVersion({
      tenantId,
      templateId: template.id,
      versionId: published.id,
      actorMembershipId: ownerMembershipId,
      reason: 'Replace obsolete schema',
      correlationId: 'phase10-form-retire',
    });
    expect(retired.status).toBe('RETIRED');
    expect(
      await db.formTemplate.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id: template.id } },
      }),
    ).toMatchObject({ currentPublishedVersionId: null });
    const archived = await repository.archiveTemplate({
      tenantId,
      templateId: template.id,
      actorMembershipId: ownerMembershipId,
      reason: 'Archive completed workflow',
      correlationId: 'phase10-form-archive',
    });
    expect(archived.status).toBe('ARCHIVED');
    await expect(
      repository.publish({
        tenantId,
        templateId: template.id,
        jsonSchema: { type: 'object' },
        actorMembershipId: ownerMembershipId,
        effectiveFrom: new Date(),
        correlationId: 'phase10-form-republish',
        reason: 'Must reject archived template',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const lifecycleAudits = await db.auditEvent.findMany({
      where: {
        tenantId,
        correlationId: { in: ['phase10-form-retire', 'phase10-form-archive'] },
      },
    });
    expect(lifecycleAudits.map((event) => event.reason).sort()).toEqual([
      'Archive completed workflow',
      'Replace obsolete schema',
    ]);
    expect(lifecycleAudits.every((event) => event.beforeRedacted && event.afterRedacted)).toBe(
      true,
    );
  });

  it('accepts concurrent different invitations for an existing member without duplication', async () => {
    const repository = new AuthTenantsRepository(db);
    const expiresAt = new Date(Date.now() + 60_000);
    const invitations = await Promise.all(
      [employeeRoleId, ownerRoleId].map((roleId, index) =>
        db.invitation.create({
          data: {
            tenantId,
            tokenHash: `${index}`.repeat(64),
            tokenHint: `p10${index}`,
            invitationType: 'DIRECT',
            roleId,
            maxUses: 1,
            expiresAt,
            createdByMembershipId: ownerMembershipId,
          },
        }),
      ),
    );
    const accepted = await Promise.all(
      invitations.map((invitation, index) =>
        repository.acceptInvitation({
          invitation,
          userId: employeeUserId,
          displayName: 'Phase Ten Employee',
          correlationId: `phase10-invite-${index}`,
        }),
      ),
    );
    expect(new Set(accepted.map((membership) => membership.id))).toEqual(
      new Set([employeeMembershipId]),
    );
    expect(await db.tenantMembership.count({ where: { tenantId } })).toBe(2);
    expect(
      await db.invitationAcceptance.count({ where: { tenantId, userId: employeeUserId } }),
    ).toBe(2);
  });

  it('replays encrypted account mutations and emits replay telemetry before replay security', async () => {
    const authRepository = new AuthTenantsRepository(db);
    const counters = new Map<string, number>();
    const governance = new GovernanceRepository(db, 'phase10-encryption-secret', {
      increment(name) {
        counters.set(name, (counters.get(name) ?? 0) + 1);
      },
    });
    const tokens = new TokenService(
      's'.repeat(32),
      'phase10-issuer',
      'phase10-audience',
      900,
      3600,
      authRepository,
    );
    const issued = await tokens.issue(ownerUserId);
    const first = await tokens.refresh(issued.refreshToken, 'phase10-refresh-0001', governance);
    const replay = await tokens.refresh(issued.refreshToken, 'phase10-refresh-0001', governance);
    expect(replay).toEqual(first);
    expect(counters.get('idempotency_replays_total')).toBe(1);
    const record = await db.accountIdempotencyRecord.findUniqueOrThrow({
      where: {
        userId_operation_key: {
          userId: ownerUserId,
          operation: 'auth.refresh',
          key: 'phase10-refresh-0001',
        },
      },
    });
    expect(record.responseBodyCiphertext).not.toContain(first.refreshToken);
    expect(record.responseBodyRedacted).toMatchObject({ refreshToken: '[REDACTED]' });
    await expect(
      tokens.refresh(issued.refreshToken, 'phase10-refresh-0002', governance),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('retains tenant history while auditing status transitions', async () => {
    const repository = new AuthTenantsRepository(db);
    await repository.updateTenantStatus({
      tenantId,
      status: 'SUSPENDED',
      actorMembershipId: ownerMembershipId,
      reason: 'Planned operational pause',
      correlationId: 'phase10-tenant-suspend',
    });
    expect(await db.tenantMembership.count({ where: { tenantId } })).toBe(2);
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { tenantId, correlationId: 'phase10-tenant-suspend' },
    });
    expect(audit).toMatchObject({
      reason: 'Planned operational pause',
      beforeRedacted: { status: 'ACTIVE' },
      afterRedacted: { status: 'SUSPENDED' },
    });
    await repository.updateTenantStatus({
      tenantId,
      status: 'ACTIVE',
      actorMembershipId: ownerMembershipId,
      reason: 'Resume operations',
      correlationId: 'phase10-tenant-resume',
    });
    const auditReasons = await db.auditEvent.findMany({
      where: { tenantId },
      select: { reason: true },
    });
    expect(auditReasons.length).toBeGreaterThan(0);
    expect(auditReasons.every((event) => event.reason.trim().length > 0)).toBe(true);
  });
});
