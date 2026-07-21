import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GovernanceRepository,
  OrganizationRbacRepository,
  createDatabaseClient,
  type DatabaseClient,
  type MediaRepository,
} from '@adsup/database';
import type { ObjectStoragePort } from '@adsup/domain';
import { MediaService } from '../../src/modules/media/media-service.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('PostgreSQL convergence guarantees', () => {
  let db: DatabaseClient;
  let firstTenantId: string;
  let secondTenantId: string;
  let firstUserId: string;
  let secondUserId: string;
  let firstMembershipId: string;
  let secondMembershipId: string;
  let firstOwnerRoleId: string;
  let secondOwnerRoleId: string;
  let foreignBranchId: string;

  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    firstTenantId = randomUUID();
    secondTenantId = randomUUID();
    firstUserId = randomUUID();
    secondUserId = randomUUID();
    firstMembershipId = randomUUID();
    secondMembershipId = randomUUID();
    firstOwnerRoleId = randomUUID();
    secondOwnerRoleId = randomUUID();
    foreignBranchId = randomUUID();
    await db.user.createMany({
      data: [
        { id: firstUserId, fullName: 'Test Owner One', fullNameConfirmedAt: new Date() },
        { id: secondUserId, fullName: 'Test Owner Two', fullNameConfirmedAt: new Date() },
      ],
    });
    await db.tenant.createMany({
      data: [
        {
          id: firstTenantId,
          name: 'Tenant Convergence One',
          slug: `convergence-one-${firstTenantId.slice(0, 8)}`,
          createdByUserId: firstUserId,
        },
        {
          id: secondTenantId,
          name: 'Tenant Convergence Two',
          slug: `convergence-two-${secondTenantId.slice(0, 8)}`,
          createdByUserId: secondUserId,
        },
      ],
    });
    await db.tenantMembership.createMany({
      data: [
        {
          tenantId: firstTenantId,
          id: firstMembershipId,
          userId: firstUserId,
          membershipDisplayName: 'Test Owner One',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        {
          tenantId: secondTenantId,
          id: secondMembershipId,
          userId: secondUserId,
          membershipDisplayName: 'Test Owner Two',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      ],
    });
    await db.role.createMany({
      data: [
        {
          tenantId: firstTenantId,
          id: firstOwnerRoleId,
          code: 'TENANT_OWNER',
          name: 'Owner',
          kind: 'SYSTEM',
        },
        {
          tenantId: secondTenantId,
          id: secondOwnerRoleId,
          code: 'TENANT_OWNER',
          name: 'Owner',
          kind: 'SYSTEM',
        },
      ],
    });
    await db.membershipRoleBinding.createMany({
      data: [
        {
          tenantId: firstTenantId,
          membershipId: firstMembershipId,
          roleId: firstOwnerRoleId,
          scopeType: 'TENANT',
          effectiveFrom: new Date(),
          grantedByMembershipId: firstMembershipId,
        },
        {
          tenantId: secondTenantId,
          membershipId: secondMembershipId,
          roleId: secondOwnerRoleId,
          scopeType: 'TENANT',
          effectiveFrom: new Date(),
          grantedByMembershipId: secondMembershipId,
        },
      ],
    });
    await db.branch.create({
      data: {
        tenantId: secondTenantId,
        id: foreignBranchId,
        code: 'FOREIGN',
        name: 'Foreign Branch',
        createdByMembershipId: secondMembershipId,
      },
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditEvent.deleteMany({
      where: { tenantId: { in: [firstTenantId, secondTenantId] } },
    });
    await db.tenantIdempotencyRecord.deleteMany({
      where: { tenantId: { in: [firstTenantId, secondTenantId] } },
    });
    await db.assignment.deleteMany({
      where: { tenantId: { in: [firstTenantId, secondTenantId] } },
    });
    await db.membershipRoleBinding.deleteMany({
      where: { tenantId: { in: [firstTenantId, secondTenantId] } },
    });
    await db.branch.deleteMany({ where: { tenantId: { in: [firstTenantId, secondTenantId] } } });
    await db.role.deleteMany({ where: { tenantId: { in: [firstTenantId, secondTenantId] } } });
    await db.tenantMembership.deleteMany({
      where: { tenantId: { in: [firstTenantId, secondTenantId] } },
    });
    await db.tenant.deleteMany({ where: { id: { in: [firstTenantId, secondTenantId] } } });
    await db.user.deleteMany({ where: { id: { in: [firstUserId, secondUserId] } } });
    await db.$disconnect();
  });

  it('replays an encrypted response and rejects key reuse with a different request', async () => {
    const governance = new GovernanceRepository(db, 'test-encryption-secret');
    let calls = 0;
    const execute = (request: unknown) =>
      governance.executeTenantIdempotent({
        tenantId: firstTenantId,
        membershipId: firstMembershipId,
        operation: 'test.convergence',
        key: 'convergence-idempotency-0001',
        request,
        action: async () => {
          calls += 1;
          return { id: randomUUID(), refreshToken: 'sensitive-response-value' };
        },
      });
    const first = await execute({ name: 'same' });
    const replay = await execute({ name: 'same' });
    expect(replay.replayed).toBe(true);
    expect(replay.value).toEqual(first.value);
    expect(calls).toBe(1);
    await expect(execute({ name: 'different' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    const stored = await db.tenantIdempotencyRecord.findFirstOrThrow({
      where: { tenantId: firstTenantId, operation: 'test.convergence' },
    });
    expect(stored.responseBodyRedacted).toMatchObject({ refreshToken: '[REDACTED]' });
    expect(stored.responseBodyCiphertext).not.toContain('sensitive-response-value');
  });

  it('blocks the only active owner inside a serializable transaction', async () => {
    const repository = new OrganizationRbacRepository(db);
    await expect(
      repository.updateMembershipWithOwnerGuard({
        tenantId: firstTenantId,
        membershipId: firstMembershipId,
        actorMembershipId: firstMembershipId,
        status: 'SUSPENDED',
        reason: 'Concurrent safety check',
        correlationId: 'postgres-last-owner',
      }),
    ).rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
    expect(
      await db.tenantMembership.count({
        where: { tenantId: firstTenantId, id: firstMembershipId, status: 'ACTIVE' },
      }),
    ).toBe(1);
  });

  it('preserves one active owner when two owners are suspended concurrently', async () => {
    const repository = new OrganizationRbacRepository(db);
    const otherUserId = randomUUID();
    const otherMembershipId = randomUUID();
    await db.user.create({
      data: { id: otherUserId, fullName: 'Concurrent Owner', fullNameConfirmedAt: new Date() },
    });
    await db.tenantMembership.create({
      data: {
        tenantId: firstTenantId,
        id: otherMembershipId,
        userId: otherUserId,
        membershipDisplayName: 'Concurrent Owner',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    await db.membershipRoleBinding.create({
      data: {
        tenantId: firstTenantId,
        membershipId: otherMembershipId,
        roleId: firstOwnerRoleId,
        scopeType: 'TENANT',
        effectiveFrom: new Date(),
        grantedByMembershipId: firstMembershipId,
      },
    });
    const suspend = (membershipId: string) =>
      repository.updateMembershipWithOwnerGuard({
        tenantId: firstTenantId,
        membershipId,
        actorMembershipId: firstMembershipId,
        status: 'SUSPENDED',
        reason: 'Concurrent owner transition',
        correlationId: `postgres-owner-${membershipId}`,
      });
    const outcomes = await Promise.allSettled([
      suspend(firstMembershipId),
      suspend(otherMembershipId),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const activeOwnerMemberships = await db.tenantMembership.count({
      where: {
        tenantId: firstTenantId,
        id: { in: [firstMembershipId, otherMembershipId] },
        status: 'ACTIVE',
      },
    });
    expect(activeOwnerMemberships).toBe(1);
    await db.auditEvent.deleteMany({
      where: { tenantId: firstTenantId, targetId: otherMembershipId },
    });
    await db.membershipRoleBinding.deleteMany({
      where: { tenantId: firstTenantId, membershipId: otherMembershipId },
    });
    await db.tenantMembership.delete({
      where: { tenantId_id: { tenantId: firstTenantId, id: otherMembershipId } },
    });
    await db.user.delete({ where: { id: otherUserId } });
    await db.tenantMembership.update({
      where: { tenantId_id: { tenantId: firstTenantId, id: firstMembershipId } },
      data: { status: 'ACTIVE', suspendedAt: null },
    });
  });

  it('rejects a nested foreign identifier from another tenant at the database boundary', async () => {
    await expect(
      db.assignment.create({
        data: {
          tenantId: firstTenantId,
          membershipId: firstMembershipId,
          branchId: foreignBranchId,
          effectiveFrom: new Date(),
          createdByMembershipId: firstMembershipId,
        },
      }),
    ).rejects.toBeTruthy();
  });
});

describe('provider failure boundary', () => {
  it('does not mark media ready when object storage verification fails', async () => {
    let transitioned = false;
    const repository = {
      async get() {
        return {
          tenantId: 'tenant',
          id: 'media',
          ownerMembershipId: 'member',
          branchId: null,
          status: 'PENDING_UPLOAD',
          uploadExpiresAt: new Date(Date.now() + 60_000),
          objectKey: 'tenant/media',
          contentType: 'image/jpeg',
          byteSize: 1n,
          checksumSha256: 'a'.repeat(64),
        };
      },
      async markReady() {
        transitioned = true;
      },
      async markRejected() {
        transitioned = true;
      },
    } as unknown as MediaRepository;
    const storage = {
      async createUploadUrl() {
        throw new Error('unused');
      },
      async createDownloadUrl() {
        throw new Error('unused');
      },
      async head() {
        throw new Error('provider unavailable');
      },
      async delete() {
        throw new Error('unused');
      },
    } satisfies ObjectStoragePort;
    const service = new MediaService(repository, storage, 'test', 60);
    await expect(service.complete('tenant', 'media', 'member', 'provider-failure')).rejects.toThrow(
      'provider unavailable',
    );
    expect(transitioned).toBe(false);
  });
});
