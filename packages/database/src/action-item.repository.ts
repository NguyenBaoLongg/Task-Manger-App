import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from './client.js';
import { decodeTimeCursor, encodeTimeCursor } from './cursor.js';

export class ActionItemRepository {
  constructor(private readonly db: DatabaseClient) {}

  async project(input: {
    tenantId: string;
    ownerMembershipId: string;
    branchId?: string | null;
    departmentId?: string | null;
    itemType: 'KPI_REPORT' | 'KPI_SHORTFALL' | 'PHOTO_DEBT' | 'DATA_QUALITY';
    sourceType: string;
    sourceId: string;
    businessDate: Date;
    state: 'OPEN' | 'OVERDUE' | 'COMPLETED' | 'DISMISSED';
    title: string;
    targetValue?: string | null;
    actualValue?: string | null;
    remainingValue?: string | null;
    unit?: string | null;
    deadlineAt: Date;
    sourceFreshnessAt: Date;
    deepLink: string;
    eventId?: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM tenant_memberships
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.ownerMembershipId}::uuid
        FOR UPDATE
      `;
      const natural = {
        tenantId: input.tenantId,
        ownerMembershipId: input.ownerMembershipId,
        itemType: input.itemType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        businessDate: input.businessDate,
      };
      const existing = await tx.actionItem.findUnique({
        where: { tenantId_ownerMembershipId_itemType_sourceType_sourceId_businessDate: natural },
      });
      const projectionChanged =
        !existing ||
        existing.branchId !== (input.branchId ?? null) ||
        existing.departmentId !== (input.departmentId ?? null) ||
        existing.state !== input.state ||
        existing.title !== input.title ||
        existing.targetValue !== (input.targetValue ?? null) ||
        existing.actualValue !== (input.actualValue ?? null) ||
        existing.remainingValue !== (input.remainingValue ?? null) ||
        existing.unit !== (input.unit ?? null) ||
        existing.deadlineAt.getTime() !== input.deadlineAt.getTime() ||
        existing.sourceFreshnessAt.getTime() !== input.sourceFreshnessAt.getTime() ||
        existing.deepLink !== input.deepLink;
      const item = existing
        ? await tx.actionItem.update({
            where: { tenantId_id: { tenantId: input.tenantId, id: existing.id } },
            data: {
              branchId: input.branchId,
              departmentId: input.departmentId,
              state: input.state,
              title: input.title,
              targetValue: input.targetValue,
              actualValue: input.actualValue,
              remainingValue: input.remainingValue,
              unit: input.unit,
              deadlineAt: input.deadlineAt,
              sourceFreshnessAt: input.sourceFreshnessAt,
              deepLink: input.deepLink,
              stateVersion: projectionChanged ? { increment: 1 } : undefined,
              completedAt: input.state === 'COMPLETED' ? input.sourceFreshnessAt : null,
            },
          })
        : await tx.actionItem.create({
            data: {
              ...natural,
              branchId: input.branchId,
              departmentId: input.departmentId,
              state: input.state,
              title: input.title,
              targetValue: input.targetValue,
              actualValue: input.actualValue,
              remainingValue: input.remainingValue,
              unit: input.unit,
              deadlineAt: input.deadlineAt,
              sourceFreshnessAt: input.sourceFreshnessAt,
              deepLink: input.deepLink,
              completedAt: input.state === 'COMPLETED' ? input.sourceFreshnessAt : null,
            },
          });
      if (projectionChanged) {
        const eventId = input.eventId ?? randomUUID();
        await tx.actionItemTransition.upsert({
          where: {
            tenantId_actionItemId_sourceEventId: {
              tenantId: input.tenantId,
              actionItemId: item.id,
              sourceEventId: eventId,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            actionItemId: item.id,
            fromState: existing?.state,
            toState: item.state,
            reasonCode: existing ? 'SOURCE_REFRESHED' : 'SOURCE_CREATED',
            sourceEventId: eventId,
            snapshotJson: {
              stateVersion: item.stateVersion,
              itemType: item.itemType,
              remainingValue: item.remainingValue,
            },
            occurredAt: input.sourceFreshnessAt,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            eventType: 'ACTION_ITEM_PROJECTED',
            targetType: 'ACTION_ITEM',
            targetId: item.id,
            reason: existing ? 'SOURCE_REFRESHED' : 'SOURCE_CREATED',
            beforeRedacted: existing
              ? {
                  state: existing.state,
                  stateVersion: existing.stateVersion,
                  remainingValue: existing.remainingValue,
                }
              : undefined,
            afterRedacted: {
              state: item.state,
              stateVersion: item.stateVersion,
              remainingValue: item.remainingValue,
            },
          },
        });
        await tx.outboxEvent.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId: input.tenantId,
              dedupeKey: `action-item:${item.id}:v${item.stateVersion}`,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            aggregateType: 'ACTION_ITEM',
            aggregateId: item.id,
            eventType: 'action-item.changed',
            dedupeKey: `action-item:${item.id}:v${item.stateVersion}`,
            payloadRedacted: {
              actionItemId: item.id,
              ownerMembershipId: item.ownerMembershipId,
              state: item.state,
              stateVersion: item.stateVersion,
            },
            correlationId: input.correlationId,
          },
        });
      }
      return item;
    });
  }

  projectAttendanceSource(input: {
    tenantId: string;
    ownerMembershipId: string;
    branchId?: string | null;
    sourceType:
      | 'ATTENDANCE_MISSING_CHECKIN'
      | 'ATTENDANCE_VIDEO_REVIEW'
      | 'APPROVAL_DECISION_REQUIRED'
      | 'APPROVAL_NEEDS_INFO'
      | 'PENALTY_PAYMENT_DUE'
      | 'ABSENCE_OVER_THRESHOLD';
    sourceId: string;
    businessDate: Date;
    title: string;
    deadlineAt: Date;
    correlationId: string;
  }) {
    return this.project({
      ...input,
      itemType: 'DATA_QUALITY',
      state: 'OPEN',
      sourceFreshnessAt: new Date(),
      deepLink: `adsup://attendance/${input.sourceType.toLowerCase()}/${input.sourceId}`,
    });
  }

  projectPenaltyPayment(input: {
    tenantId: string;
    ownerMembershipId: string;
    branchId: string;
    sourceId: string;
    businessDate: Date;
    amountMinor: bigint;
    state: 'OPEN' | 'COMPLETED';
    title: string;
    correlationId: string;
  }) {
    const now = new Date();
    return this.project({
      tenantId: input.tenantId,
      ownerMembershipId: input.ownerMembershipId,
      branchId: input.branchId,
      itemType: 'DATA_QUALITY',
      sourceType: 'PENALTY_PAYMENT_DUE',
      sourceId: input.sourceId,
      businessDate: input.businessDate,
      state: input.state,
      title: input.title,
      targetValue: input.amountMinor.toString(),
      unit: 'VND',
      deadlineAt: input.businessDate,
      sourceFreshnessAt: now,
      deepLink: `adsup://attendance/penalties/${input.sourceId}`,
      correlationId: input.correlationId,
    });
  }

  async listMine(input: {
    tenantId: string;
    membershipId: string;
    state?: 'OPEN' | 'OVERDUE' | 'COMPLETED' | 'DISMISSED';
    businessDate?: Date;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 100);
    const cursor = decodeTimeCursor(input.cursor);
    const where = {
      tenantId: input.tenantId,
      ownerMembershipId: input.membershipId,
      state: input.state,
      businessDate: input.businessDate,
      AND: cursor
        ? [
            {
              OR: [
                { updatedAt: { lt: cursor.timestamp } },
                { updatedAt: cursor.timestamp, id: { lt: cursor.id } },
              ],
            },
          ]
        : undefined,
    };
    const page = await this.db.actionItem.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const hasNext = page.length > take;
    const items = page.slice(0, take);
    const last = items.at(-1);
    const openCount = await this.db.actionItem.count({
      where: {
        tenantId: input.tenantId,
        ownerMembershipId: input.membershipId,
        state: { in: ['OPEN', 'OVERDUE'] },
      },
    });
    return {
      items,
      openCount,
      nextCursor: hasNext && last ? encodeTimeCursor(last.updatedAt, last.id) : null,
    };
  }

  async listTransitions(input: {
    tenantId: string;
    actionItemId: string;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(Math.max(input.take ?? 50, 1), 200);
    const cursor = decodeTimeCursor(input.cursor);
    const page = await this.db.actionItemTransition.findMany({
      where: {
        tenantId: input.tenantId,
        actionItemId: input.actionItemId,
        AND: cursor
          ? [
              {
                OR: [
                  { occurredAt: { lt: cursor.timestamp } },
                  { occurredAt: cursor.timestamp, id: { lt: cursor.id } },
                ],
              },
            ]
          : undefined,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const items = page.slice(0, take);
    const last = items.at(-1);
    return {
      items,
      nextCursor: page.length > take && last ? encodeTimeCursor(last.occurredAt, last.id) : null,
    };
  }

  async listManaged(input: {
    tenantId: string;
    branchIds?: string[];
    branchId?: string;
    departmentId?: string;
    membershipId?: string;
    itemType?: 'KPI_REPORT' | 'KPI_SHORTFALL' | 'PHOTO_DEBT' | 'DATA_QUALITY';
    state?: 'OPEN' | 'OVERDUE' | 'COMPLETED' | 'DISMISSED';
    from?: Date;
    to?: Date;
    cursor?: string;
    take?: number;
  }) {
    const cursor = decodeTimeCursor(input.cursor);
    const where = {
      tenantId: input.tenantId,
      branchId: input.branchId ?? (input.branchIds ? { in: input.branchIds } : undefined),
      departmentId: input.departmentId,
      ownerMembershipId: input.membershipId,
      itemType: input.itemType,
      state: input.state,
      businessDate: input.from || input.to ? { gte: input.from, lte: input.to } : undefined,
    };
    const take = Math.min(Math.max(input.take ?? 50, 1), 100);
    const page = await this.db.actionItem.findMany({
      where: {
        ...where,
        AND: cursor
          ? [
              {
                OR: [
                  { updatedAt: { lt: cursor.timestamp } },
                  { updatedAt: cursor.timestamp, id: { lt: cursor.id } },
                ],
              },
            ]
          : undefined,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const hasNext = page.length > take;
    const items = page.slice(0, take);
    const last = items.at(-1);
    const grouped = await this.db.actionItem.groupBy({
      by: ['itemType'],
      where: { ...where, state: { in: ['OPEN', 'OVERDUE'] } },
      _count: true,
    });
    const count = (type: string) => grouped.find((item) => item.itemType === type)?._count ?? 0;
    return {
      items,
      openCount: grouped.reduce((sum, item) => sum + item._count, 0),
      nextCursor: hasNext && last ? encodeTimeCursor(last.updatedAt, last.id) : null,
      summary: {
        missingReports: count('KPI_REPORT'),
        failedKpis: count('KPI_SHORTFALL'),
        photoDebts: count('PHOTO_DEBT'),
        overdue: await this.db.actionItem.count({ where: { ...where, state: 'OVERDUE' } }),
      },
    };
  }
}
