import { ProblemError, type GooglePrincipal } from '@adsup/domain';
import type { DatabaseClient } from './client.js';

export class AuthTenantsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async loginWithGoogle(principal: GooglePrincipal, correlationId = 'system') {
    return this.db.$transaction(async (tx) => {
      const identity = await tx.externalIdentity.findUnique({
        where: {
          provider_providerSubject: { provider: 'GOOGLE', providerSubject: principal.subject },
        },
      });
      if (identity) {
        await tx.externalIdentity.update({
          where: { id: identity.id },
          data: {
            email: principal.email?.toLowerCase(),
            emailVerified: principal.emailVerified,
            lastLoginAt: new Date(),
          },
        });
        const user = await tx.user.findUniqueOrThrow({ where: { id: identity.userId } });
        await tx.securityEvent.create({
          data: {
            userId: user.id,
            eventType: 'GOOGLE_LOGIN_SUCCEEDED',
            correlationId,
            metadataRedacted: { provider: 'GOOGLE' },
          },
        });
        return user;
      }
      const user = await tx.user.create({ data: {} });
      await tx.externalIdentity.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerSubject: principal.subject,
          email: principal.email?.toLowerCase(),
          emailVerified: principal.emailVerified,
        },
      });
      await tx.securityEvent.create({
        data: {
          userId: user.id,
          eventType: 'GOOGLE_ACCOUNT_CREATED',
          correlationId,
          metadataRedacted: { provider: 'GOOGLE' },
        },
      });
      return user;
    });
  }

  getUser(userId: string) {
    return this.db.user.findUnique({ where: { id: userId } });
  }
  confirmProfile(userId: string, fullName: string, correlationId = 'system') {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { fullName: fullName.trim(), fullNameConfirmedAt: new Date() },
      });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: 'PROFILE_CONFIRMED',
          correlationId,
          metadataRedacted: { profileComplete: true },
        },
      });
      return user;
    });
  }
  createSession(data: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    tokenFamilyId: string;
    expiresAt: Date;
  }) {
    return this.db.authSession.create({ data });
  }
  findSessionByHash(refreshTokenHash: string) {
    return this.db.authSession.findUnique({ where: { refreshTokenHash } });
  }
  getSession(sessionId: string) {
    return this.db.authSession.findUnique({ where: { id: sessionId } });
  }
  async rotateSession(input: {
    priorId: string;
    nextId: string;
    userId: string;
    tokenFamilyId: string;
    nextHash: string;
    expiresAt: Date;
  }) {
    return this.db.$transaction(async (tx) => {
      const prior = await tx.authSession.findUniqueOrThrow({ where: { id: input.priorId } });
      if (prior.revokedAt) return null;
      const next = await tx.authSession.create({
        data: {
          id: input.nextId,
          userId: input.userId,
          tokenFamilyId: input.tokenFamilyId,
          refreshTokenHash: input.nextHash,
          expiresAt: input.expiresAt,
        },
      });
      await tx.authSession.update({
        where: { id: input.priorId },
        data: { revokedAt: new Date(), revokeReason: 'ROTATED', replacedBySessionId: next.id },
      });
      return next;
    });
  }
  revokeSession(sessionId: string, reason: string) {
    return this.db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }
  revokeFamily(tokenFamilyId: string, reason: string) {
    return this.db.authSession.updateMany({
      where: { tokenFamilyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async listTenants(userId: string) {
    const memberships = await this.db.tenantMembership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      memberships.map(async (membership) => ({
        membership,
        tenant: await this.db.tenant.findUniqueOrThrow({ where: { id: membership.tenantId } }),
      })),
    );
  }
  findMembership(tenantId: string, userId: string) {
    return this.db.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }
  getTenant(tenantId: string) {
    return this.db.tenant.findUnique({ where: { id: tenantId } });
  }
  updateTenantStatus(data: {
    tenantId: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id: data.tenantId } });
      const tenant = await tx.tenant.update({
        where: { id: data.tenantId },
        data: { status: data.status },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.actorMembershipId,
          correlationId: data.correlationId,
          eventType: 'TENANT_STATUS_CHANGED',
          targetType: 'TENANT',
          targetId: data.tenantId,
          reason: data.reason,
          beforeRedacted: { status: before.status },
          afterRedacted: { status: tenant.status },
        },
      });
      return tenant;
    });
  }

  async bootstrapTenant(input: {
    tenantId: string;
    ownerMembershipId: string;
    userId: string;
    name: string;
    slug: string;
    timezone: string;
    correlationId: string;
    idempotencyKey: string;
    requestHash: string;
  }) {
    const existing = await this.db.accountIdempotencyRecord.findUnique({
      where: {
        userId_operation_key: {
          userId: input.userId,
          operation: 'tenant.create',
          key: input.idempotencyKey,
        },
      },
    });
    if (existing?.requestHash !== undefined && existing.requestHash !== input.requestHash)
      throw new ProblemError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Khóa idempotency đã dùng cho yêu cầu khác.',
      );
    if (existing?.status === 'COMPLETED' && existing.resourceId) {
      return {
        tenant: await this.db.tenant.findUniqueOrThrow({ where: { id: existing.resourceId } }),
        membership: await this.db.tenantMembership.findUniqueOrThrow({
          where: { tenantId_userId: { tenantId: existing.resourceId, userId: input.userId } },
        }),
      };
    }
    if (existing) throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
    return this.db.$transaction(
      async (tx) => {
        const idempotency = await tx.accountIdempotencyRecord.create({
          data: {
            userId: input.userId,
            operation: 'tenant.create',
            key: input.idempotencyKey,
            requestHash: input.requestHash,
            lockedUntil: new Date(Date.now() + 30_000),
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
        const tenant = await tx.tenant.create({
          data: {
            id: input.tenantId,
            name: input.name,
            slug: input.slug,
            timezone: input.timezone,
            createdByUserId: input.userId,
          },
        });
        const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
        const membership = await tx.tenantMembership.create({
          data: {
            tenantId: input.tenantId,
            id: input.ownerMembershipId,
            userId: input.userId,
            membershipDisplayName: user.fullName!,
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });
        // Interactive transactions use one checked-out pg client; keep queries sequential.
        const roles = [
          await tx.role.create({
            data: {
              tenantId: input.tenantId,
              code: 'TENANT_OWNER',
              name: 'Chủ doanh nghiệp',
              kind: 'SYSTEM',
            },
          }),
          await tx.role.create({
            data: { tenantId: input.tenantId, code: 'MANAGER', name: 'Quản lý', kind: 'SYSTEM' },
          }),
          await tx.role.create({
            data: { tenantId: input.tenantId, code: 'EMPLOYEE', name: 'Nhân viên', kind: 'SYSTEM' },
          }),
        ];
        const ownerRole = roles[0]!;
        const permissions = await tx.permission.findMany();
        if (permissions.length)
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              tenantId: input.tenantId,
              roleId: ownerRole.id,
              permissionId: permission.id,
            })),
            skipDuplicates: true,
          });
        const managerCodes = new Set([
          'tenant.read',
          'branch.manage',
          'organization.manage',
          'member.read',
          'member.invite',
          'member.manage',
          'role.read',
          'form.read',
          'form.manage',
          'form.submit',
          'chat.read',
          'chat.write',
          'chat.manage',
          'media.create',
          'media.read',
        ]);
        const employeeCodes = new Set([
          'tenant.read',
          'member.read',
          'form.read',
          'form.submit',
          'chat.read',
          'chat.write',
          'media.create',
          'media.read',
        ]);
        await tx.rolePermission.createMany({
          data: permissions
            .filter((permission) => managerCodes.has(permission.code))
            .map((permission) => ({
              tenantId: input.tenantId,
              roleId: roles[1]!.id,
              permissionId: permission.id,
            })),
          skipDuplicates: true,
        });
        await tx.rolePermission.createMany({
          data: permissions
            .filter((permission) => employeeCodes.has(permission.code))
            .map((permission) => ({
              tenantId: input.tenantId,
              roleId: roles[2]!.id,
              permissionId: permission.id,
            })),
          skipDuplicates: true,
        });
        await tx.membershipRoleBinding.create({
          data: {
            tenantId: input.tenantId,
            membershipId: membership.id,
            roleId: ownerRole.id,
            scopeType: 'TENANT',
            effectiveFrom: new Date(),
            grantedByMembershipId: membership.id,
          },
        });
        await tx.chatChannel.create({
          data: {
            tenantId: input.tenantId,
            type: 'TENANT_GENERAL',
            name: 'Kênh chung',
            createdByMembershipId: membership.id,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            actorMembershipId: membership.id,
            actorUserId: input.userId,
            correlationId: input.correlationId,
            eventType: 'TENANT_CREATED',
            targetType: 'TENANT',
            targetId: tenant.id,
            reason: 'TENANT_CREATED_BY_USER',
          },
        });
        await tx.accountIdempotencyRecord.update({
          where: { id: idempotency.id },
          data: {
            status: 'COMPLETED',
            responseStatus: 201,
            resourceId: tenant.id,
            responseBodyRedacted: { tenantId: tenant.id },
          },
        });
        return { tenant, membership };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  createInvitation(data: {
    tenantId: string;
    tokenHash: string;
    tokenHint: string;
    invitationType: 'DIRECT' | 'GROUP_LINK';
    roleId: string;
    branchId?: string;
    maxUses: number;
    expiresAt: Date;
    createdByMembershipId: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const invitation = await tx.invitation.create({
        data: {
          tenantId: data.tenantId,
          tokenHash: data.tokenHash,
          tokenHint: data.tokenHint,
          invitationType: data.invitationType,
          roleId: data.roleId,
          branchId: data.branchId,
          maxUses: data.maxUses,
          expiresAt: data.expiresAt,
          createdByMembershipId: data.createdByMembershipId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.createdByMembershipId,
          correlationId: data.correlationId,
          eventType: 'INVITATION_CREATED',
          targetType: 'INVITATION',
          targetId: invitation.id,
          reason: 'INVITATION_CREATED_BY_ACTOR',
          afterRedacted: {
            invitationType: invitation.invitationType,
            roleId: invitation.roleId,
            branchId: invitation.branchId,
            maxUses: invitation.maxUses,
            expiresAt: invitation.expiresAt.toISOString(),
          },
        },
      });
      return invitation;
    });
  }
  listInvitations(tenantId: string) {
    return this.db.invitation.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }
  revokeInvitation(
    tenantId: string,
    invitationId: string,
    actorMembershipId: string,
    correlationId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const invitation = await tx.invitation.update({
        where: { tenantId_id: { tenantId, id: invitationId } },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorMembershipId,
          correlationId,
          eventType: 'INVITATION_REVOKED',
          targetType: 'INVITATION',
          targetId: invitationId,
          reason: 'INVITATION_REVOKED_BY_ACTOR',
          afterRedacted: { revokedAt: invitation.revokedAt?.toISOString() },
        },
      });
      return invitation;
    });
  }
  findInvitationByHash(tokenHash: string) {
    return this.db.invitation.findUnique({ where: { tokenHash } });
  }
  async acceptInvitation(input: InvitationAcceptanceInput) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.acceptInvitationOnce(input);
      } catch (error) {
        lastError = error;
        if (!isRetryableTransactionError(error) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5 * (attempt + 1)));
      }
    }
    throw lastError;
  }
  private acceptInvitationOnce(input: InvitationAcceptanceInput) {
    return this.db.$transaction(
      async (tx) => {
        const current = await tx.invitation.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: input.invitation.tenantId, id: input.invitation.id } },
        });
        const priorAcceptance = await tx.invitationAcceptance.findUnique({
          where: {
            tenantId_invitationId_userId: {
              tenantId: current.tenantId,
              invitationId: current.id,
              userId: input.userId,
            },
          },
        });
        if (priorAcceptance)
          return tx.tenantMembership.findUniqueOrThrow({
            where: {
              tenantId_id: { tenantId: current.tenantId, id: priorAcceptance.membershipId },
            },
          });
        if (
          current.revokedAt ||
          current.expiresAt <= new Date() ||
          current.useCount >= current.maxUses
        )
          throw new ProblemError(410, 'RESOURCE_GONE', 'Lời mời không còn hiệu lực.');
        let membership = await tx.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: current.tenantId, userId: input.userId } },
        });
        if (!membership)
          membership = await tx.tenantMembership.create({
            data: {
              tenantId: current.tenantId,
              userId: input.userId,
              membershipDisplayName: input.displayName.trim(),
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          });
        if (membership.status !== 'ACTIVE')
          membership = await tx.tenantMembership.update({
            where: { tenantId_id: { tenantId: current.tenantId, id: membership.id } },
            data: { status: 'ACTIVE', joinedAt: new Date() },
          });
        const binding = await tx.membershipRoleBinding.findFirst({
          where: {
            tenantId: current.tenantId,
            membershipId: membership.id,
            roleId: current.roleId,
            scopeType: current.branchId ? 'BRANCH' : 'TENANT',
            branchId: current.branchId,
            effectiveFrom: current.createdAt,
          },
        });
        if (!binding)
          await tx.membershipRoleBinding.create({
            data: {
              tenantId: current.tenantId,
              membershipId: membership.id,
              roleId: current.roleId,
              scopeType: current.branchId ? 'BRANCH' : 'TENANT',
              branchId: current.branchId,
              effectiveFrom: current.createdAt,
              grantedByMembershipId: current.createdByMembershipId,
            },
          });
        await tx.invitationAcceptance.upsert({
          where: {
            tenantId_invitationId_userId: {
              tenantId: current.tenantId,
              invitationId: current.id,
              userId: input.userId,
            },
          },
          update: {},
          create: {
            tenantId: current.tenantId,
            invitationId: current.id,
            userId: input.userId,
            membershipId: membership.id,
            correlationId: input.correlationId,
          },
        });
        const existing = await tx.invitationAcceptance.count({
          where: { tenantId: current.tenantId, invitationId: current.id },
        });
        await tx.invitation.update({
          where: { tenantId_id: { tenantId: current.tenantId, id: current.id } },
          data: { useCount: existing },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: current.tenantId,
            actorMembershipId: membership.id,
            actorUserId: input.userId,
            correlationId: input.correlationId,
            eventType: 'INVITATION_ACCEPTED',
            targetType: 'TENANT_MEMBERSHIP',
            targetId: membership.id,
            reason: 'INVITATION_ACCEPTED_BY_USER',
            afterRedacted: {
              invitationId: current.id,
              roleId: current.roleId,
              branchId: current.branchId,
            },
          },
        });
        return membership;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}

interface InvitationAcceptanceInput {
  invitation: {
    tenantId: string;
    id: string;
    roleId: string;
    branchId: string | null;
    useCount: number;
    maxUses: number;
    expiresAt: Date;
    revokedAt: Date | null;
  };
  userId: string;
  displayName: string;
  correlationId: string;
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === 'P2002' || code === 'P2034') return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('SET TRANSACTION ISOLATION LEVEL must be called before any query');
}
