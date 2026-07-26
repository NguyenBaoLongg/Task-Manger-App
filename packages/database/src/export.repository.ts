import { createHash, randomUUID } from 'node:crypto';
import { runInTransaction, type DatabaseExecutor } from './client.js';

export const MAX_EXPORT_ATTEMPTS = 5;
export const EXPORT_DATA_TYPES = ['BOOKINGS', 'TOURS', 'KPI', 'PENALTIES', 'ACTION_ITEMS'] as const;
export type ExportDataType = (typeof EXPORT_DATA_TYPES)[number];
export type ExportSourceCursors = Partial<Record<ExportDataType, string | null>>;

export interface CreateExportRequestInput {
  tenantId: string;
  requesterMembershipId: string;
  idempotencyKey: string;
  correlationId: string;
  requestHash: string;
  format: 'XLSX';
  dataTypes: string[];
  dateFrom: Date;
  dateTo: Date;
  branchIds: string[];
  departmentIds?: string[];
  membershipIds?: string[];
}

export interface ExportRowQuery {
  tenantId: string;
  branchIds: string[];
  dateFrom: Date;
  dateTo: Date;
  dataTypes: string[];
  cursor?: string | null;
  sourceCursors?: ExportSourceCursors;
  take?: number;
}

export class ExportRepository {
  constructor(readonly database: DatabaseExecutor) {}

  async createOrGetRequest(input: CreateExportRequestInput) {
    const where = {
      tenantId_requesterMembershipId_idempotencyKey: {
        tenantId: input.tenantId,
        requesterMembershipId: input.requesterMembershipId,
        idempotencyKey: input.idempotencyKey,
      },
    } as const;
    const existing = await this.database.exportRequest.findUnique({ where });
    if (existing) return existing;
    try {
      return await runInTransaction(this.database, async (transaction) => {
        const created = await transaction.exportRequest.create({
          data: {
            tenantId: input.tenantId,
            requesterMembershipId: input.requesterMembershipId,
            format: input.format,
            dataTypesJson: input.dataTypes,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            branchScopeJson: input.branchIds,
            filterJson: {
              departmentIds: input.departmentIds ?? [],
              membershipIds: input.membershipIds ?? [],
            },
            requestHash: input.requestHash,
            idempotencyKey: input.idempotencyKey,
            correlationId: input.correlationId,
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            actorMembershipId: input.requesterMembershipId,
            correlationId: input.correlationId,
            eventType: 'EXPORT_REQUESTED',
            targetType: 'EXPORT_REQUEST',
            targetId: created.id,
            reason: 'EXPORT_REQUEST_CREATED',
            afterRedacted: {
              format: input.format,
              dataTypes: input.dataTypes,
              dateFrom: input.dateFrom.toISOString().slice(0, 10),
              dateTo: input.dateTo.toISOString().slice(0, 10),
              branchIds: input.branchIds,
            },
          },
        });
        return created;
      });
    } catch {
      return this.database.exportRequest.findUniqueOrThrow({ where });
    }
  }

  async listExports(input: {
    tenantId: string;
    requesterMembershipId: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const rows = await this.database.exportRequest.findMany({
      where: {
        tenantId: input.tenantId,
        requesterMembershipId: input.requesterMembershipId,
        id: input.cursor ? { gt: input.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  async getExport(tenantId: string, exportId: string) {
    const request = await this.database.exportRequest.findUnique({
      where: { tenantId_id: { tenantId, id: exportId } },
    });
    if (!request) return null;
    const media = request.mediaObjectId
      ? await this.database.mediaObject.findUnique({
          where: { tenantId_id: { tenantId, id: request.mediaObjectId } },
        })
      : null;
    return { ...request, mediaObject: media };
  }

  async claimExport(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    now: Date;
    leaseMs?: number;
  }) {
    const leaseUntil = new Date(input.now.getTime() + (input.leaseMs ?? 120_000));
    const result = await this.database.exportRequest.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.exportId,
        OR: [
          { state: 'PENDING' },
          { state: 'RETRYABLE', nextAttemptAt: null },
          { state: 'RETRYABLE', nextAttemptAt: { lte: input.now } },
          { state: 'RUNNING', leaseUntil: { lt: input.now } },
        ],
      },
      data: {
        state: 'RUNNING',
        attempt: { increment: 1 },
        leaseOwner: input.workerId,
        leaseUntil,
      },
    });
    if (!result.count) return null;
    const request = await this.database.exportRequest.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.exportId } },
    });
    if (!request) return null;
    return request;
  }

  getTenantTimezone(tenantId: string) {
    return this.database.tenant
      .findUnique({ where: { id: tenantId }, select: { timezone: true } })
      .then((tenant) => tenant?.timezone ?? 'UTC');
  }

  listRunnableExports(input: { limit?: number; now?: Date }) {
    const now = input.now ?? new Date();
    return this.database.exportRequest.findMany({
      where: {
        OR: [
          { state: 'PENDING' },
          { state: 'RETRYABLE', nextAttemptAt: null },
          { state: 'RETRYABLE', nextAttemptAt: { lte: now } },
          { state: 'RUNNING', leaseUntil: { lt: now } },
        ],
      },
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(input.limit ?? 10, 1), 100),
      select: { tenantId: true, id: true },
    });
  }

  async listExportRows(input: ExportRowQuery) {
    const take = Math.min(Math.max(input.take ?? 500, 1), 2_000);
    const rows: Array<Record<string, unknown>> = [];
    const nextCursors: ExportSourceCursors = {};
    const cursorFor = (dataType: ExportDataType) =>
      input.sourceCursors?.[dataType] ??
      (input.dataTypes.length === 1 ? (input.cursor ?? null) : null);

    if (input.dataTypes.includes('BOOKINGS')) {
      const bookings = await this.database.booking.findMany({
        where: {
          tenantId: input.tenantId,
          branchId: { in: input.branchIds },
          businessDate: { gte: input.dateFrom, lte: input.dateTo },
          id: cursorFor('BOOKINGS') ? { gt: cursorFor('BOOKINGS')! } : undefined,
        },
        orderBy: { id: 'asc' },
        take: take + 1,
      });
      const hasNext = bookings.length > take;
      const page = hasNext ? bookings.slice(0, take) : bookings;
      nextCursors.BOOKINGS = hasNext ? (page.at(-1)?.id ?? null) : null;
      rows.push(
        ...page.map((row) => ({
          dataType: 'BOOKINGS',
          id: row.id,
          branchId: row.branchId,
          businessDate: row.businessDate.toISOString().slice(0, 10),
          status: row.status,
          bookingType: row.bookingType,
          scheduledStartAt: row.scheduledStartAt.toISOString(),
          serviceCode: row.serviceCodeSnapshot,
          serviceName: row.serviceNameSnapshot,
          assignedMembershipId: row.assignedMembershipId,
        })),
      );
    }
    if (input.dataTypes.includes('TOURS')) {
      const tours = await this.database.tourCompletion.findMany({
        where: {
          tenantId: input.tenantId,
          branchId: { in: input.branchIds },
          businessDate: { gte: input.dateFrom, lte: input.dateTo },
          id: cursorFor('TOURS') ? { gt: cursorFor('TOURS')! } : undefined,
        },
        orderBy: { id: 'asc' },
        take: take + 1,
      });
      const hasNext = tours.length > take;
      const page = hasNext ? tours.slice(0, take) : tours;
      nextCursors.TOURS = hasNext ? (page.at(-1)?.id ?? null) : null;
      rows.push(
        ...page.map((row) => ({
          dataType: 'TOURS',
          id: row.id,
          branchId: row.branchId,
          businessDate: row.businessDate.toISOString().slice(0, 10),
          bookingId: row.bookingId,
          performedByMembershipId: row.performedByMembershipId,
          completedAt: row.completedAt.toISOString(),
        })),
      );
    }
    if (input.dataTypes.includes('KPI')) {
      const evaluations = await this.database.dailyKpiEvaluation.findMany({
        where: {
          tenantId: input.tenantId,
          branchId: { in: input.branchIds },
          businessDate: { gte: input.dateFrom, lte: input.dateTo },
          id: cursorFor('KPI') ? { gt: cursorFor('KPI')! } : undefined,
        },
        orderBy: { id: 'asc' },
        take: take + 1,
      });
      const hasNext = evaluations.length > take;
      const page = hasNext ? evaluations.slice(0, take) : evaluations;
      nextCursors.KPI = hasNext ? (page.at(-1)?.id ?? null) : null;
      rows.push(
        ...page.map((row) => ({
          dataType: 'KPI',
          id: row.id,
          branchId: row.branchId,
          businessDate: row.businessDate.toISOString().slice(0, 10),
          membershipId: row.membershipId,
          status: row.status,
        })),
      );
    }
    if (input.dataTypes.includes('PENALTIES')) {
      const penalties = await this.database.penaltyOutcome.findMany({
        where: {
          tenantId: input.tenantId,
          branchId: { in: input.branchIds },
          businessDate: { gte: input.dateFrom, lte: input.dateTo },
          id: cursorFor('PENALTIES') ? { gt: cursorFor('PENALTIES')! } : undefined,
        },
        orderBy: { id: 'asc' },
        take: take + 1,
      });
      const hasNext = penalties.length > take;
      const page = hasNext ? penalties.slice(0, take) : penalties;
      nextCursors.PENALTIES = hasNext ? (page.at(-1)?.id ?? null) : null;
      rows.push(
        ...page.map((row) => ({
          dataType: 'PENALTIES',
          id: row.id,
          branchId: row.branchId,
          businessDate: row.businessDate.toISOString().slice(0, 10),
          membershipId: row.membershipId,
          kind: row.kind,
          amountMinor: Number(row.amountMinor),
          currency: row.currency,
          status: row.status,
        })),
      );
    }
    if (input.dataTypes.includes('ACTION_ITEMS')) {
      const actionItems = await this.database.actionItem.findMany({
        where: {
          tenantId: input.tenantId,
          branchId: { in: input.branchIds },
          businessDate: { gte: input.dateFrom, lte: input.dateTo },
          id: cursorFor('ACTION_ITEMS') ? { gt: cursorFor('ACTION_ITEMS')! } : undefined,
        },
        orderBy: { id: 'asc' },
        take: take + 1,
      });
      const hasNext = actionItems.length > take;
      const page = hasNext ? actionItems.slice(0, take) : actionItems;
      nextCursors.ACTION_ITEMS = hasNext ? (page.at(-1)?.id ?? null) : null;
      rows.push(
        ...page.map((row) => ({
          dataType: 'ACTION_ITEMS',
          id: row.id,
          branchId: row.branchId,
          businessDate: row.businessDate.toISOString().slice(0, 10),
          ownerMembershipId: row.ownerMembershipId,
          itemType: row.itemType,
          state: row.state,
          title: row.title,
        })),
      );
    }
    rows.sort(
      (left, right) =>
        String(left.dataType).localeCompare(String(right.dataType)) ||
        String(left.id).localeCompare(String(right.id)),
    );
    const firstDataType = input.dataTypes[0] as ExportDataType | undefined;
    return {
      rows,
      nextCursor:
        input.dataTypes.length === 1 && firstDataType ? (nextCursors[firstDataType] ?? null) : null,
      nextCursors,
    };
  }

  async countExportRows(input: {
    tenantId: string;
    branchIds: string[];
    dateFrom: Date;
    dateTo: Date;
    dataTypes: string[];
  }) {
    const counts: Partial<Record<ExportDataType, number>> = {};
    const where = {
      tenantId: input.tenantId,
      branchId: { in: input.branchIds },
      businessDate: { gte: input.dateFrom, lte: input.dateTo },
    };
    if (input.dataTypes.includes('BOOKINGS'))
      counts.BOOKINGS = await this.database.booking.count({ where });
    if (input.dataTypes.includes('TOURS'))
      counts.TOURS = await this.database.tourCompletion.count({ where });
    if (input.dataTypes.includes('KPI'))
      counts.KPI = await this.database.dailyKpiEvaluation.count({ where });
    if (input.dataTypes.includes('PENALTIES'))
      counts.PENALTIES = await this.database.penaltyOutcome.count({ where });
    if (input.dataTypes.includes('ACTION_ITEMS'))
      counts.ACTION_ITEMS = await this.database.actionItem.count({ where });
    return counts;
  }

  async markProgress(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    progressRows: number;
    checkpoint: string | null;
  }) {
    return this.database.exportRequest.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.exportId,
        state: 'RUNNING',
        leaseOwner: input.workerId,
      },
      data: { progressRows: input.progressRows, checkpoint: input.checkpoint },
    });
  }

  async markReady(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    ownerMembershipId: string;
    objectKey: string;
    bucket: string;
    content?: Buffer;
    checksumSha256: string;
    byteSize: number;
    rowCount: number;
    expiresAt: Date;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const mediaObjectId = randomUUID();
      const media = await transaction.mediaObject.create({
        data: {
          tenantId: input.tenantId,
          id: mediaObjectId,
          ownerMembershipId: input.ownerMembershipId,
          branchId: null,
          sourceType: 'EXPORT_REQUEST',
          sourceId: input.exportId,
          purpose: 'REPORT_XLSX',
          storageProvider: 's3-compatible',
          bucket: input.bucket,
          objectKey: input.objectKey,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          byteSize: BigInt(input.byteSize),
          checksumSha256: input.checksumSha256,
          status: 'READY',
          uploadExpiresAt: input.expiresAt,
          readyAt: new Date(),
          retentionUntil: input.expiresAt,
        },
      });
      const updated = await transaction.exportRequest.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.exportId,
          state: 'RUNNING',
          leaseOwner: input.workerId,
        },
        data: {
          state: 'READY',
          progressRows: input.rowCount,
          checkpoint: null,
          nextAttemptAt: null,
          leaseOwner: null,
          leaseUntil: null,
          mediaObjectId: media.id,
          checksumSha256: input.checksumSha256,
          byteSize: BigInt(input.byteSize),
          expiresAt: input.expiresAt,
        },
      });
      if (!updated.count) return null;
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.ownerMembershipId,
          correlationId: input.correlationId,
          eventType: 'EXPORT_READY',
          targetType: 'EXPORT_REQUEST',
          targetId: input.exportId,
          reason: 'EXPORT_GENERATED',
          afterRedacted: { rowCount: input.rowCount, byteSize: input.byteSize },
        },
      });
      await transaction.outboxEvent.upsert({
        where: {
          tenantId_dedupeKey: {
            tenantId: input.tenantId,
            dedupeKey: `export-ready:${input.exportId}`,
          },
        },
        update: {},
        create: {
          tenantId: input.tenantId,
          aggregateType: 'EXPORT',
          aggregateId: input.exportId,
          eventType: 'export.ready.v1',
          dedupeKey: `export-ready:${input.exportId}`,
          payloadRedacted: {
            exportId: input.exportId,
            requesterMembershipId: input.ownerMembershipId,
            format: 'XLSX',
            mediaObjectId: media.id,
            rowCount: input.rowCount,
            byteSize: input.byteSize,
            checksum: input.checksumSha256,
            expiry: input.expiresAt.toISOString(),
          },
          correlationId: input.correlationId,
        },
      });
      return media;
    });
  }

  async markRetryable(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    code: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    return runInTransaction(this.database, async (transaction) => {
      const current = await transaction.exportRequest.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.exportId } },
        select: { attempt: true },
      });
      if (!current) return null;
      const terminal = current.attempt >= MAX_EXPORT_ATTEMPTS;
      const delayMs = Math.min(15 * 60_000, 1_000 * 2 ** Math.max(0, current.attempt - 1));
      return transaction.exportRequest.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.exportId,
          state: 'RUNNING',
          leaseOwner: input.workerId,
        },
        data: {
          state: terminal ? 'FAILED' : 'RETRYABLE',
          safeErrorCode: input.code,
          nextAttemptAt: terminal ? null : new Date(now.getTime() + delayMs),
          leaseOwner: null,
          leaseUntil: null,
        },
      });
    });
  }

  markFailed(input: { tenantId: string; exportId: string; workerId: string; code: string }) {
    return this.database.exportRequest.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.exportId,
        state: 'RUNNING',
        leaseOwner: input.workerId,
      },
      data: {
        state: 'FAILED',
        safeErrorCode: input.code,
        nextAttemptAt: null,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
  }
}

export function exportRequestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
