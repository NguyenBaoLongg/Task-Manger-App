import type { DatabaseClient } from './client.js';
import { retentionUntilForMedia } from '@adsup/domain';

export class MediaRepository {
  constructor(private readonly db: DatabaseClient) {}
  createIntent(data: {
    tenantId: string;
    ownerMembershipId: string;
    branchId?: string | null;
    sourceType: string;
    sourceId?: string | null;
    purpose: string;
    consentId?: string | null;
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
      const retentionPolicy =
        data.purpose === 'CUSTOMER_BOOKING_PHOTO'
          ? await tx.bookingRetentionPolicyVersion.findFirst({
              where: {
                tenantId: data.tenantId,
                effectiveFrom: { lte: new Date() },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
              },
              orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
            })
          : null;
      const createdAt = new Date();
      const media = await tx.mediaObject.create({
        data: {
          tenantId: data.tenantId,
          ownerMembershipId: data.ownerMembershipId,
          branchId: data.branchId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          purpose: data.purpose,
          consentId: data.consentId,
          storageProvider: data.storageProvider,
          bucket: data.bucket,
          objectKey: data.objectKey,
          contentType: data.contentType,
          byteSize: data.byteSize,
          checksumSha256: data.checksumSha256,
          uploadExpiresAt: data.uploadExpiresAt,
          retentionUntil: retentionPolicy
            ? retentionUntilForMedia(data.purpose, createdAt, retentionPolicy)
            : data.purpose === 'CUSTOMER_BOOKING_PHOTO'
              ? retentionUntilForMedia(data.purpose, createdAt, {
                  customerPhotoDays: 180,
                  xlsxDays: 30,
                })
              : undefined,
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
  async getCustomerPhotoAuthorization(input: {
    tenantId: string;
    branchId: string;
    bookingId: string;
    consentId: string;
    at?: Date;
  }) {
    const at = input.at ?? new Date();
    const consent = await this.db.customerPhotoConsent.findUnique({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: input.consentId,
        },
      },
    });
    if (!consent || consent.bookingId !== input.bookingId || consent.branchId !== input.branchId) {
      return null;
    }
    const [booking, policy] = await Promise.all([
      this.db.booking.findUnique({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: input.bookingId,
          },
        },
      }),
      this.db.customerPhotoConsentPolicyVersion.findUnique({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: consent.policyVersionId,
          },
        },
      }),
    ]);
    if (
      !booking ||
      booking.branchId !== input.branchId ||
      booking.customerId !== consent.customerId ||
      !policy ||
      policy.status !== 'ACTIVE' ||
      policy.effectiveFrom > at ||
      (policy.effectiveTo !== null && policy.effectiveTo <= at)
    ) {
      return null;
    }
    return {
      bookingId: booking.id,
      branchId: booking.branchId,
      customerId: booking.customerId,
      ownerMembershipId: booking.assignedMembershipId,
      consentId: consent.id,
    };
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
      if (status === 'READY') {
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId,
              dedupeKey: `media-ready:${id}`,
            },
          },
          update: {},
          create: {
            tenantId,
            aggregateType: 'MEDIA_OBJECT',
            aggregateId: id,
            eventType: 'media.ready.v1',
            dedupeKey: `media-ready:${id}`,
            payloadRedacted: {
              mediaId: id,
              branchId: media.branchId,
              sourceType: media.sourceType,
              sourceId: media.sourceId,
              purpose: media.purpose,
              consentId: media.consentId,
            },
            correlationId,
          },
        });
        if (
          media.purpose === 'CUSTOMER_BOOKING_PHOTO' &&
          media.sourceType === 'BOOKING' &&
          media.sourceId &&
          media.branchId &&
          media.consentId
        ) {
          const [booking, consent] = await Promise.all([
            tx.booking.findUnique({
              where: {
                tenantId_id: {
                  tenantId,
                  id: media.sourceId,
                },
              },
              select: { customerId: true, branchId: true },
            }),
            tx.customerPhotoConsent.findUnique({
              where: {
                tenantId_id: {
                  tenantId,
                  id: media.consentId,
                },
              },
            }),
          ]);
          if (
            booking &&
            consent &&
            consent.bookingId === media.sourceId &&
            consent.branchId === media.branchId &&
            consent.customerId === booking.customerId &&
            booking.branchId === media.branchId
          ) {
            await tx.outboxEvent.upsert({
              where: {
                tenantId_dedupeKey: {
                  tenantId,
                  dedupeKey: `booking-customer-photo-ready:${id}`,
                },
              },
              update: {},
              create: {
                tenantId,
                aggregateType: 'BOOKING',
                aggregateId: media.sourceId,
                eventType: 'booking.customer-photo-ready.v1',
                dedupeKey: `booking-customer-photo-ready:${id}`,
                payloadRedacted: {
                  bookingId: media.sourceId,
                  branchId: media.branchId,
                  customerId: booking.customerId,
                  mediaId: media.id,
                },
                correlationId,
              },
            });
          }
        }
      }
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
    if (sourceType === 'BOOKING') {
      const item = await this.db.booking.findUnique({
        where: { tenantId_id: { tenantId, id: sourceId } },
        select: { assignedMembershipId: true, branchId: true },
      });
      return item
        ? { ownerMembershipId: item.assignedMembershipId, branchId: item.branchId }
        : null;
    }
    return null;
  }
}
