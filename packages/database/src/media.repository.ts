import type { DatabaseClient } from './client.js';

export class MediaRepository {
  constructor(private readonly db: DatabaseClient) {}
  createIntent(data: {
    tenantId: string;
    ownerMembershipId: string;
    branchId?: string | null;
    sourceType: string;
    sourceId?: string | null;
    purpose: string;
    storageProvider: string;
    bucket: string;
    objectKey: string;
    contentType: string;
    byteSize: bigint;
    checksumSha256: string;
    uploadExpiresAt: Date;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const media = await tx.mediaObject.create({
        data: {
          tenantId: data.tenantId,
          ownerMembershipId: data.ownerMembershipId,
          branchId: data.branchId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          purpose: data.purpose,
          storageProvider: data.storageProvider,
          bucket: data.bucket,
          objectKey: data.objectKey,
          contentType: data.contentType,
          byteSize: data.byteSize,
          checksumSha256: data.checksumSha256,
          uploadExpiresAt: data.uploadExpiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.ownerMembershipId,
          correlationId: data.correlationId,
          eventType: 'MEDIA_UPLOAD_INTENT_CREATED',
          targetType: 'MEDIA_OBJECT',
          targetId: media.id,
          reason: 'MEDIA_UPLOAD_REQUESTED_BY_ACTOR',
          afterRedacted: {
            sourceType: media.sourceType,
            sourceId: media.sourceId,
            purpose: media.purpose,
            contentType: media.contentType,
            byteSize: media.byteSize.toString(),
          },
        },
      });
      return media;
    });
  }
  get(tenantId: string, id: string) {
    return this.db.mediaObject.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }
  markReady(tenantId: string, id: string, actorMembershipId: string, correlationId: string) {
    return this.transition(tenantId, id, 'READY', actorMembershipId, correlationId);
  }
  markRejected(tenantId: string, id: string, actorMembershipId: string, correlationId: string) {
    return this.transition(tenantId, id, 'REJECTED', actorMembershipId, correlationId);
  }
  private transition(
    tenantId: string,
    id: string,
    status: 'READY' | 'REJECTED',
    actorMembershipId: string,
    correlationId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.mediaObject.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id } },
      });
      const media = await tx.mediaObject.update({
        where: { tenantId_id: { tenantId, id } },
        data: { status, readyAt: status === 'READY' ? new Date() : undefined },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorMembershipId,
          correlationId,
          eventType: `MEDIA_${status}`,
          targetType: 'MEDIA_OBJECT',
          targetId: id,
          reason: status === 'READY' ? 'UPLOAD_VERIFIED' : 'UPLOAD_VALIDATION_REJECTED',
          beforeRedacted: { status: before.status },
          afterRedacted: { status: media.status },
        },
      });
      return media;
    });
  }
  async getSource(tenantId: string, sourceType: string, sourceId: string) {
    if (sourceType === 'FORM_SUBMISSION') {
      const item = await this.db.formSubmission.findUnique({
        where: { tenantId_id: { tenantId, id: sourceId } },
        select: { submittedByMembershipId: true, branchId: true },
      });
      return item
        ? { ownerMembershipId: item.submittedByMembershipId, branchId: item.branchId }
        : null;
    }
    if (sourceType === 'CHAT_MESSAGE') {
      const item = await this.db.chatMessage.findUnique({
        where: { tenantId_id: { tenantId, id: sourceId } },
        select: { authorMembershipId: true, channelId: true },
      });
      if (!item) return null;
      const channel = await this.db.chatChannel.findUnique({
        where: { tenantId_id: { tenantId, id: item.channelId } },
        select: { branchId: true },
      });
      return { ownerMembershipId: item.authorMembershipId, branchId: channel?.branchId ?? null };
    }
    if (sourceType === 'PROFILE' || sourceType === 'TENANT_MEMBERSHIP') {
      const item = await this.db.tenantMembership.findUnique({
        where: { tenantId_id: { tenantId, id: sourceId } },
        select: { id: true },
      });
      return item ? { ownerMembershipId: item.id, branchId: null } : null;
    }
    return null;
  }
}
