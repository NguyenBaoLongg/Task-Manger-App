import { runInTransaction, type DatabaseExecutor } from './client.js';
import { ActionItemRepository } from './action-item.repository.js';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { BookingReportBooking } from '@adsup/domain';

export class BookingWorkerRepository {
  constructor(readonly database: DatabaseExecutor) {}

  listTenantIds() {
    return this.database.tenant
      .findMany({ select: { id: true } })
      .then((rows) => rows.map((row) => row.id));
  }

  getTenantTimezone(tenantId: string) {
    return this.database.tenant
      .findUnique({ where: { id: tenantId }, select: { timezone: true } })
      .then((row) => row?.timezone ?? 'Asia/Ho_Chi_Minh');
  }

  listActiveBranchIds(tenantId: string) {
    return this.database.branch
      .findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      .then((rows) => rows.map((row) => row.id));
  }

  listBookingRetentionCandidates(tenantId: string, now: Date, take = 100) {
    return this.database.mediaObject.findMany({
      where: {
        tenantId,
        status: 'READY',
        retentionUntil: { lte: now },
        purpose: { in: ['CUSTOMER_BOOKING_PHOTO', 'REPORT_XLSX'] },
      },
      select: {
        tenantId: true,
        id: true,
        objectKey: true,
        purpose: true,
        createdAt: true,
        legalHoldAt: true,
        retentionUntil: true,
      },
      orderBy: [{ retentionUntil: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  getRetentionPolicyAt(input: { tenantId: string; at: Date }) {
    return this.database.bookingRetentionPolicyVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        effectiveFrom: { lte: input.at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.at } }],
      },
      select: { id: true },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
    });
  }

  async tombstoneMediaObject(input: {
    tenantId: string;
    mediaObjectId: string;
    policyVersionId?: string | null;
    reason: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const media = await transaction.mediaObject.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.mediaObjectId } },
      });
      if (!media || media.status === 'DELETED' || media.legalHoldAt) return null;
      const tombstone = await transaction.mediaRetentionTombstone.upsert({
        where: {
          tenantId_storageProvider_bucket_objectKey: {
            tenantId: media.tenantId,
            storageProvider: media.storageProvider,
            bucket: media.bucket,
            objectKey: media.objectKey,
          },
        },
        update: {},
        create: {
          tenantId: media.tenantId,
          mediaObjectId: media.id,
          sourceType: media.sourceType,
          sourceId: media.sourceId,
          purpose: media.purpose,
          storageProvider: media.storageProvider,
          bucket: media.bucket,
          objectKey: media.objectKey,
          checksumSha256: media.checksumSha256,
          byteSize: media.byteSize,
          contentType: media.contentType,
          policyVersionId: input.policyVersionId,
          legalHoldReleased: false,
          reason: input.reason,
        },
      });
      await transaction.mediaObject.update({
        where: { tenantId_id: { tenantId: media.tenantId, id: media.id } },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: media.tenantId,
          correlationId: `booking-retention:${media.id}`,
          eventType: 'BOOKING_MEDIA_RETENTION_DELETED',
          targetType: 'MEDIA_OBJECT',
          targetId: media.id,
          reason: input.reason,
          beforeRedacted: { status: media.status, purpose: media.purpose },
          afterRedacted: { status: 'DELETED', tombstoneId: tombstone.id },
        },
      });
      await transaction.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: media.tenantId,
            dedupeKey: `booking-media-retention:${tombstone.id}`,
          },
        },
        update: {},
        create: {
          tenantId: media.tenantId,
          aggregateType: 'MEDIA_RETENTION_TOMBSTONE',
          aggregateId: tombstone.id,
          eventType: 'booking.media-retention.tombstoned.v1',
          dedupeKey: `booking-media-retention:${tombstone.id}`,
          payloadRedacted: {
            tombstoneId: tombstone.id,
            mediaObjectId: media.id,
            purpose: media.purpose,
          },
          correlationId: `booking-retention:${media.id}`,
        },
      });
      return tombstone;
    });
  }

  enqueueReportRerun(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
    businessDate: Date;
    branchIds?: string[];
    reason: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const branchIds: string[] =
        input.branchIds ??
        (
          await transaction.branch.findMany({
            where: { tenantId: input.tenantId, status: 'ACTIVE' },
            select: { id: true },
            orderBy: { id: 'asc' },
          })
        ).map((row) => row.id);
      const run = await transaction.bookingJobRun.create({
        data: {
          tenantId: input.tenantId,
          jobType: `BOOKING_REPORT_${input.reportType}`,
          reportType: input.reportType,
          businessDate: input.businessDate,
          branchScopeJson: [...new Set(branchIds)].sort(),
          inputHash: createHash('sha256')
            .update(
              `${input.reportType}:${input.businessDate.toISOString()}:${branchIds.join(',')}:${input.reason}:${randomUUID()}`,
            )
            .digest('hex'),
          correlationId: input.correlationId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_REPORT_RERUN_REQUESTED',
          targetType: 'BOOKING_JOB_RUN',
          targetId: run.id,
          reason: input.reason,
          afterRedacted: {
            reportType: input.reportType,
            businessDate: input.businessDate.toISOString().slice(0, 10),
            branchIds,
          },
        },
      });
      return run;
    });
  }

  listBookingReportDestinations(input: {
    tenantId: string;
    reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
    effectiveAt: Date;
  }) {
    return this.database.bookingReportDestination.findMany({
      where: {
        tenantId: input.tenantId,
        reportType: input.reportType,
        status: 'ACTIVE',
        effectiveFrom: { lte: input.effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }],
      },
      orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
    });
  }

  ensureReportRun(input: {
    tenantId: string;
    reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
    businessDate: Date;
    branchIds: string[];
    correlationId: string;
    revision?: number;
  }) {
    const branchScopeJson = [...new Set(input.branchIds)].sort();
    const inputHash = createHash('sha256')
      .update(
        JSON.stringify({
          reportType: input.reportType,
          businessDate: input.businessDate.toISOString(),
          branchScopeJson,
          revision: input.revision ?? 1,
        }),
      )
      .digest('hex');
    return this.database.bookingJobRun.upsert({
      where: {
        tenantId_jobType_businessDate_inputHash: {
          tenantId: input.tenantId,
          jobType: `BOOKING_REPORT_${input.reportType}`,
          businessDate: input.businessDate,
          inputHash,
        },
      },
      update: {},
      create: {
        tenantId: input.tenantId,
        jobType: `BOOKING_REPORT_${input.reportType}`,
        reportType: input.reportType,
        businessDate: input.businessDate,
        branchScopeJson,
        inputHash,
        correlationId: input.correlationId,
      },
    });
  }

  ensureRetentionRun(input: { tenantId: string; businessDate: Date; correlationId: string }) {
    const inputHash = createHash('sha256')
      .update(`BOOKING_MEDIA_RETENTION:${input.businessDate.toISOString().slice(0, 10)}`)
      .digest('hex');
    return this.database.bookingJobRun.upsert({
      where: {
        tenantId_jobType_businessDate_inputHash: {
          tenantId: input.tenantId,
          jobType: 'BOOKING_MEDIA_RETENTION',
          businessDate: input.businessDate,
          inputHash,
        },
      },
      update: {},
      create: {
        tenantId: input.tenantId,
        jobType: 'BOOKING_MEDIA_RETENTION',
        businessDate: input.businessDate,
        branchScopeJson: [],
        inputHash,
        correlationId: input.correlationId,
      },
    });
  }

  claimRetentionRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs: number;
  }) {
    return this.claimReportRun(input);
  }

  completeRetentionRun(input: { tenantId: string; runId: string; leaseOwner: string; now: Date }) {
    return this.database.bookingJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        state: 'RUNNING',
        leaseOwner: input.leaseOwner,
      },
      data: { state: 'SUCCEEDED', completedAt: input.now, leaseUntil: null },
    });
  }

  failRetentionRun(input: { tenantId: string; runId: string; leaseOwner: string; code: string }) {
    return this.failReportRun({
      tenantId: input.tenantId,
      runId: input.runId,
      leaseOwner: input.leaseOwner,
      code: input.code,
    });
  }

  claimReportRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs: number;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM booking_job_runs
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.runId}::uuid
          AND (state IN ('PENDING', 'RETRYABLE') OR (state = 'RUNNING' AND lease_until <= ${input.now}))
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return null;
      return transaction.bookingJobRun.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.runId } },
        data: {
          state: 'RUNNING',
          attempt: { increment: 1 },
          leaseOwner: input.leaseOwner,
          leaseUntil: new Date(input.now.getTime() + input.leaseDurationMs),
          startedAt: input.now,
          safeErrorCode: null,
        },
      });
    });
  }

  heartbeatReportRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs: number;
  }) {
    return this.database.bookingJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        state: 'RUNNING',
        leaseOwner: input.leaseOwner,
      },
      data: { leaseUntil: new Date(input.now.getTime() + input.leaseDurationMs) },
    });
  }

  completeReportRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    now: Date;
    checkpoint?: string;
    contentHash: string;
    destinationCount: number;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const run = await transaction.bookingJobRun.findFirst({
        where: {
          tenantId: input.tenantId,
          id: input.runId,
          state: 'RUNNING',
          leaseOwner: input.leaseOwner,
        },
      });
      if (!run) return { count: 0 };
      const completed = await transaction.bookingJobRun.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.runId } },
        data: {
          state: 'SUCCEEDED',
          completedAt: input.now,
          checkpoint: input.checkpoint,
          leaseUntil: null,
        },
      });
      const branchScope = Array.isArray(run.branchScopeJson) ? run.branchScopeJson : [];
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          correlationId: run.correlationId,
          eventType: 'BOOKING_REPORT_READY',
          targetType: 'BOOKING_JOB_RUN',
          targetId: run.id,
          reason: 'BOOKING_REPORT_DELIVERED',
          afterRedacted: {
            reportType: run.reportType,
            businessDate: run.businessDate.toISOString().slice(0, 10),
            branchScope,
            attempt: completed.attempt,
          },
        },
      });
      await transaction.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `booking-report-ready:${run.id}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: run.id,
          eventType: 'booking.report-ready.v1',
          dedupeKey: `booking-report-ready:${run.id}`,
          payloadRedacted: {
            reportRunId: run.id,
            reportType: run.reportType,
            businessDate: run.businessDate.toISOString().slice(0, 10),
            branchScope,
            contentHash: input.contentHash,
            destinationCount: input.destinationCount,
          },
          correlationId: run.correlationId,
        },
      });
      return { count: 1 };
    });
  }

  failReportRun(input: {
    tenantId: string;
    runId: string;
    leaseOwner: string;
    code: string;
    retryable?: boolean;
  }) {
    return this.database.bookingJobRun.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.runId,
        state: 'RUNNING',
        leaseOwner: input.leaseOwner,
      },
      data: {
        state: input.retryable === false ? 'FAILED' : 'RETRYABLE',
        safeErrorCode: input.code,
        leaseUntil: null,
      },
    });
  }

  async listBookingReportRows(input: {
    tenantId: string;
    branchIds?: string[];
    startAt: Date;
    endAt: Date;
  }): Promise<BookingReportBooking[]> {
    const bookings = await this.database.booking.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.branchIds ? { branchId: { in: input.branchIds } } : {}),
        scheduledStartAt: { gte: input.startAt, lt: input.endAt },
      },
      orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
    });
    const [branches, memberships, customers, transitions, tours, debts] = await Promise.all([
      this.database.branch.findMany({
        where: {
          tenantId: input.tenantId,
          ...(input.branchIds ? { id: { in: input.branchIds } } : {}),
        },
        select: { id: true, name: true },
      }),
      this.database.tenantMembership.findMany({
        where: {
          tenantId: input.tenantId,
          id: { in: [...new Set(bookings.map((row) => row.assignedMembershipId))] },
        },
        select: { id: true, membershipDisplayName: true },
      }),
      this.database.customer.findMany({
        where: {
          tenantId: input.tenantId,
          id: { in: [...new Set(bookings.map((row) => row.customerId))] },
        },
        select: { id: true, displayName: true },
      }),
      this.database.bookingStatusTransition.findMany({
        where: { tenantId: input.tenantId, bookingId: { in: bookings.map((row) => row.id) } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      this.database.tourCompletion.findMany({
        where: {
          tenantId: input.tenantId,
          bookingId: { in: bookings.map((row) => row.id) },
          supersededAt: null,
        },
        select: { bookingId: true },
      }),
      this.database.customerPhotoDebt.findMany({
        where: {
          tenantId: input.tenantId,
          bookingId: { in: bookings.map((row) => row.id) },
          state: 'OPEN',
        },
        select: { bookingId: true },
      }),
    ]);
    const branchMap = new Map(branches.map((row) => [row.id, row.name]));
    const membershipMap = new Map(memberships.map((row) => [row.id, row.membershipDisplayName]));
    const customerMap = new Map(customers.map((row) => [row.id, row.displayName]));
    const transitionMap = new Map<string, (typeof transitions)[number]>();
    for (const row of transitions)
      if (!transitionMap.has(row.bookingId)) transitionMap.set(row.bookingId, row);
    const completed = new Set(tours.map((row) => row.bookingId));
    const debtsOpen = new Set(debts.map((row) => row.bookingId));
    return bookings.map((row) => {
      const transition = transitionMap.get(row.id);
      return {
        id: row.id,
        branchId: row.branchId,
        branchName: branchMap.get(row.branchId) ?? row.branchId,
        assignedMembershipId: row.assignedMembershipId,
        assignedDisplayName:
          membershipMap.get(row.assignedMembershipId) ?? row.assignedMembershipId,
        customerDisplayName: customerMap.get(row.customerId) ?? row.customerId,
        scheduledStartAt: row.scheduledStartAt.toISOString(),
        status: row.status,
        reasonCode: transition?.reasonCodeSnapshot ?? null,
        reasonLabel: transition?.reasonLabelSnapshot ?? null,
        tourCompleted: completed.has(row.id),
        photoDebtOpen: debtsOpen.has(row.id),
      };
    });
  }

  async upsertReportDelivery(input: {
    tenantId: string;
    runId: string;
    branchId?: string;
    destinationChannelId: string;
    revision: number;
    dedupeKey: string;
    contentHash: string;
  }) {
    try {
      return await this.database.bookingReportDelivery.create({
        data: {
          tenantId: input.tenantId,
          runId: input.runId,
          branchId: input.branchId,
          destinationChannelId: input.destinationChannelId,
          revision: input.revision,
          dedupeKey: input.dedupeKey,
          contentHash: input.contentHash,
        },
      });
    } catch {
      return this.database.bookingReportDelivery.findUniqueOrThrow({
        where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey: input.dedupeKey } },
      });
    }
  }

  markReportDeliverySent(input: { tenantId: string; deliveryId: string; messageId: string }) {
    return this.database.bookingReportDelivery.update({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.deliveryId } },
      data: {
        state: 'SUCCEEDED',
        messageId: input.messageId,
        attempt: { increment: 1 },
        safeErrorCode: null,
      },
    });
  }

  markReportDeliveryFailed(input: { tenantId: string; deliveryId: string; code: string }) {
    return this.database.bookingReportDelivery.update({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.deliveryId } },
      data: { state: 'RETRYABLE', attempt: { increment: 1 }, safeErrorCode: input.code },
    });
  }

  resolveCustomerPhotoDebt(input: {
    tenantId: string;
    mediaId: string;
    sourceEventId: string;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const media = await transaction.mediaObject.findUnique({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: input.mediaId,
          },
        },
      });
      if (
        !media ||
        media.status !== 'READY' ||
        media.purpose !== 'CUSTOMER_BOOKING_PHOTO' ||
        media.sourceType !== 'BOOKING' ||
        !media.sourceId ||
        !media.consentId
      ) {
        return { changed: false as const };
      }
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM customer_photo_debts
        WHERE tenant_id = ${input.tenantId}::uuid AND booking_id = ${media.sourceId}::uuid
        FOR UPDATE
      `;
      const debt = await transaction.customerPhotoDebt.findUnique({
        where: {
          tenantId_bookingId: {
            tenantId: input.tenantId,
            bookingId: media.sourceId,
          },
        },
      });
      if (!debt || debt.state !== 'OPEN' || debt.branchId !== media.branchId) {
        return { changed: false as const };
      }
      const booking = await transaction.booking.findUniqueOrThrow({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: media.sourceId,
          },
        },
      });
      const consent = await transaction.customerPhotoConsent.findUnique({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: media.consentId,
          },
        },
      });
      if (
        !consent ||
        consent.bookingId !== booking.id ||
        consent.branchId !== booking.branchId ||
        consent.customerId !== booking.customerId ||
        media.branchId !== booking.branchId
      ) {
        return { changed: false as const };
      }
      const actionItem = await new ActionItemRepository(transaction).project({
        tenantId: input.tenantId,
        ownerMembershipId: debt.ownerMembershipId,
        branchId: debt.branchId,
        itemType: 'PHOTO_DEBT',
        sourceType: 'BOOKING_CUSTOMER_PHOTO_DEBT',
        sourceId: debt.id,
        businessDate: booking.businessDate,
        state: 'COMPLETED',
        title: 'Đã bổ sung ảnh khách cho lịch hẹn',
        targetValue: '1',
        actualValue: '1',
        remainingValue: '0',
        unit: 'PHOTO',
        deadlineAt: new Date(booking.businessDate.getTime() + 24 * 60 * 60_000 - 1),
        sourceFreshnessAt: media.readyAt ?? new Date(),
        deepLink: `adsup://bookings/${booking.id}/customer-photo`,
        eventId: input.sourceEventId,
        correlationId: input.correlationId,
      });
      const resolved = await transaction.customerPhotoDebt.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: debt.id } },
        data: {
          state: 'RESOLVED',
          stateVersion: { increment: 1 },
          actionItemId: actionItem.id,
          resolvedMediaId: media.id,
          resolvedByMembershipId: null,
          resolvedAt: media.readyAt ?? new Date(),
          resolutionReason: 'CUSTOMER_PHOTO_MEDIA_READY',
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_PHOTO_DEBT_RESOLVED',
          targetType: 'CUSTOMER_PHOTO_DEBT',
          targetId: debt.id,
          reason: 'CUSTOMER_PHOTO_MEDIA_READY',
          beforeRedacted: { state: debt.state, stateVersion: debt.stateVersion },
          afterRedacted: {
            state: resolved.state,
            stateVersion: resolved.stateVersion,
            resolvedMediaId: media.id,
          },
        },
      });
      await transaction.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `booking-photo-debt:${debt.id}:v${resolved.stateVersion}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING_PHOTO_DEBT',
          aggregateId: debt.id,
          eventType: 'booking.photo-debt-changed.v1',
          dedupeKey: `booking-photo-debt:${debt.id}:v${resolved.stateVersion}`,
          payloadRedacted: {
            debtId: debt.id,
            bookingId: debt.bookingId,
            branchId: debt.branchId,
            ownerMembershipId: debt.ownerMembershipId,
            fromState: debt.state,
            toState: resolved.state,
            actionItemId: actionItem.id,
            consentId: media.consentId,
            businessDate: booking.businessDate.toISOString().slice(0, 10),
          },
          correlationId: input.correlationId,
        },
      });
      return { changed: true as const, debt: resolved, actionItem };
    });
  }

  async reconcileBookingActionItems(input: {
    tenantId: string;
    now: Date;
    sourceEventId: string;
    correlationId: string;
  }) {
    const bookings = await this.database.booking.findMany({
      where: {
        tenantId: input.tenantId,
        scheduledStartAt: { lt: input.now },
        status: { in: ['SCHEDULED', 'ARRIVED'] },
      },
      select: {
        id: true,
        branchId: true,
        assignedMembershipId: true,
        businessDate: true,
        scheduledStartAt: true,
        status: true,
      },
    });
    const completedTours = await this.database.$queryRaw<
      Array<{ booking_id: string; completed_at: Date }>
    >`
      SELECT booking_id, completed_at
      FROM tour_completions
      WHERE tenant_id = ${input.tenantId}::uuid AND superseded_at IS NULL
    `;
    const completedByBooking = new Map(
      completedTours.map((tour) => [
        tour.booking_id,
        { bookingId: tour.booking_id, completedAt: tour.completed_at },
      ]),
    );
    let processed = 0;
    for (const booking of bookings) {
      const missingStatusResolved = booking.status !== 'SCHEDULED';
      await new ActionItemRepository(this.database).project({
        tenantId: input.tenantId,
        ownerMembershipId: booking.assignedMembershipId,
        branchId: booking.branchId,
        itemType: 'DATA_QUALITY',
        sourceType: 'BOOKING_MISSING_STATUS',
        sourceId: booking.id,
        businessDate: booking.businessDate,
        state: missingStatusResolved ? 'COMPLETED' : 'OVERDUE',
        title: missingStatusResolved
          ? 'Booking status recorded'
          : 'Booking is missing an outcome status',
        targetValue: '1',
        actualValue: missingStatusResolved ? '1' : '0',
        remainingValue: missingStatusResolved ? '0' : '1',
        unit: 'BOOKING',
        deadlineAt: booking.scheduledStartAt,
        sourceFreshnessAt: input.now,
        deepLink: `adsup://bookings/${booking.id}`,
        eventId: input.sourceEventId,
        correlationId: input.correlationId,
      });
      processed += 1;
      if (booking.status === 'ARRIVED') {
        const tour = completedByBooking.get(booking.id);
        await new ActionItemRepository(this.database).project({
          tenantId: input.tenantId,
          ownerMembershipId: booking.assignedMembershipId,
          branchId: booking.branchId,
          itemType: 'DATA_QUALITY',
          sourceType: 'BOOKING_TOUR_INCOMPLETE',
          sourceId: booking.id,
          businessDate: booking.businessDate,
          state: tour ? 'COMPLETED' : 'OVERDUE',
          title: tour ? 'Tour completed' : 'Arrived booking is missing tour completion',
          targetValue: '1',
          actualValue: tour ? '1' : '0',
          remainingValue: tour ? '0' : '1',
          unit: 'TOUR',
          deadlineAt: booking.scheduledStartAt,
          sourceFreshnessAt: tour?.completedAt ?? input.now,
          deepLink: `adsup://bookings/${booking.id}/tour-completion`,
          eventId: input.sourceEventId,
          correlationId: input.correlationId,
        });
        processed += 1;
      }
    }
    return { processed };
  }
}
