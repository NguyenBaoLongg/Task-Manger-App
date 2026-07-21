import { redact } from '@adsup/domain';
import type { DatabaseClient, DatabaseTransaction } from './client.js';
import type { Prisma } from './generated/prisma/client.js';

type Db = DatabaseClient | DatabaseTransaction;

export interface KpiOutboxWrite {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  dedupeKey: string;
  correlationId: string;
  payload?: Record<string, unknown>;
}

export class KpiGovernanceRepository {
  constructor(private readonly db: DatabaseClient) {}

  appendOutbox(tx: Db, event: KpiOutboxWrite) {
    return tx.outboxEvent.upsert({
      where: { tenantId_dedupeKey: { tenantId: event.tenantId, dedupeKey: event.dedupeKey } },
      update: {},
      create: {
        tenantId: event.tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        dedupeKey: event.dedupeKey,
        correlationId: event.correlationId,
        payloadRedacted: redact(event.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  appendAudit(
    tx: Db,
    input: {
      tenantId: string;
      actorMembershipId?: string;
      correlationId: string;
      eventType: string;
      targetType: string;
      targetId?: string;
      reason: string;
      before?: unknown;
      after?: unknown;
      metadata?: unknown;
    },
  ) {
    return tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorMembershipId: input.actorMembershipId,
        correlationId: input.correlationId,
        eventType: input.eventType,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        beforeRedacted: redact(input.before) as Prisma.InputJsonValue,
        afterRedacted: redact(input.after) as Prisma.InputJsonValue,
        metadataRedacted: redact(input.metadata) as Prisma.InputJsonValue,
      },
    });
  }

  async claimOutbox(input: { workerId: string; now: Date; leaseUntil: Date; limit: number }) {
    return this.db.$transaction(async (tx) => {
      const limit = Math.min(Math.max(input.limit, 1), 500);
      const keys = await tx.$queryRaw<Array<{ tenant_id: string; id: string }>>`
        SELECT tenant_id, id
        FROM outbox_events
        WHERE available_at <= ${input.now}
          AND (
            status = 'PENDING'
            OR (status = 'PROCESSING' AND lease_until <= ${input.now})
          )
        ORDER BY available_at ASC, id ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;
      if (keys.length === 0) return [];
      const claimedKeys = keys.map((row) => ({ tenantId: row.tenant_id, id: row.id }));
      await tx.outboxEvent.updateMany({
        where: {
          OR: claimedKeys,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          status: 'PROCESSING',
          leaseOwner: input.workerId,
          leaseUntil: input.leaseUntil,
          attempt: { increment: 1 },
        },
      });
      return tx.outboxEvent.findMany({
        where: { OR: claimedKeys, leaseOwner: input.workerId },
        orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      });
    });
  }

  markOutboxSent(tenantId: string, id: string, workerId: string, sentAt: Date) {
    return this.db.outboxEvent.updateMany({
      where: { tenantId, id, status: 'PROCESSING', leaseOwner: workerId },
      data: { status: 'SENT', sentAt, leaseOwner: null, leaseUntil: null, lastSafeError: null },
    });
  }

  markOutboxFailed(input: {
    tenantId: string;
    id: string;
    workerId: string;
    availableAt: Date;
    safeError: string;
    deadLetter: boolean;
  }) {
    return this.db.outboxEvent.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.id,
        status: 'PROCESSING',
        leaseOwner: input.workerId,
      },
      data: {
        status: input.deadLetter ? 'DEAD_LETTER' : 'PENDING',
        availableAt: input.availableAt,
        leaseOwner: null,
        leaseUntil: null,
        lastSafeError: input.safeError.slice(0, 255),
      },
    });
  }
}
