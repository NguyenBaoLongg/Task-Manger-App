import { createHash, randomBytes } from 'node:crypto';
import { ProblemError } from '@adsup/domain';
import type { AuthTenantsRepository, Invitation, TenantMembership } from '@adsup/database';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export class InvitationService {
  constructor(private readonly repository: AuthTenantsRepository) {}
  async create(input: {
    tenantId: string;
    actorMembershipId: string;
    invitationType: 'DIRECT' | 'GROUP_LINK';
    roleId: string;
    branchId?: string;
    maxUses?: number;
    expiresAt: Date;
    correlationId: string;
  }) {
    if (input.expiresAt <= new Date())
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Thời hạn lời mời phải ở tương lai.');
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.repository.createInvitation({
      tenantId: input.tenantId,
      tokenHash: hash(token),
      tokenHint: token.slice(-6),
      invitationType: input.invitationType,
      roleId: input.roleId,
      branchId: input.branchId,
      maxUses: input.maxUses ?? 1,
      expiresAt: input.expiresAt,
      createdByMembershipId: input.actorMembershipId,
      correlationId: input.correlationId,
    });
    return {
      ...this.present(invitation),
      token,
      inviteUrl: `/join?token=${encodeURIComponent(token)}`,
    };
  }
  async list(tenantId: string) {
    return (await this.repository.listInvitations(tenantId)).map((item) => this.present(item));
  }
  async revoke(
    tenantId: string,
    invitationId: string,
    actorMembershipId: string,
    correlationId: string,
  ) {
    return this.present(
      await this.repository.revokeInvitation(
        tenantId,
        invitationId,
        actorMembershipId,
        correlationId,
      ),
    );
  }
  async accept(
    userId: string,
    token: string,
    correlationId: string,
    _idempotencyKey: string,
  ): Promise<TenantMembership> {
    const user = await this.repository.getUser(userId);
    if (!user?.fullName || !user.fullNameConfirmedAt)
      throw new ProblemError(
        409,
        'PROFILE_CONFIRMATION_REQUIRED',
        'Hãy xác nhận họ tên trước khi tham gia doanh nghiệp.',
      );
    const invitation = await this.repository.findInvitationByHash(hash(token));
    if (!invitation) throw new ProblemError(410, 'RESOURCE_GONE', 'Lời mời không còn hiệu lực.');
    if (
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.useCount >= invitation.maxUses
    )
      throw new ProblemError(410, 'RESOURCE_GONE', 'Lời mời không còn hiệu lực.');
    return this.repository.acceptInvitation({
      invitation,
      userId,
      displayName: user.fullName,
      correlationId,
    });
  }
  private present(invitation: Invitation) {
    const now = new Date();
    const state = invitation.revokedAt
      ? 'REVOKED'
      : invitation.expiresAt <= now
        ? 'EXPIRED'
        : invitation.useCount >= invitation.maxUses
          ? 'EXHAUSTED'
          : 'ACTIVE';
    return {
      id: invitation.id,
      type: invitation.invitationType,
      state,
      tokenHint: invitation.tokenHint,
      maxUses: invitation.maxUses,
      useCount: invitation.useCount,
      expiresAt: invitation.expiresAt,
    };
  }
}
