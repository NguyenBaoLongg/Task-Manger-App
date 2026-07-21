import type { DatabaseClient } from './client.js';
import { decodeTimeCursor, encodeTimeCursor } from './cursor.js';

export class AuditRepository {
  constructor(private readonly db: DatabaseClient) {}
  append(data: Parameters<DatabaseClient['auditEvent']['create']>[0]['data']) {
    return this.db.auditEvent.create({ data });
  }
  async list(
    tenantId: string,
    filters: {
      targetType?: string;
      targetId?: string;
      actorMembershipId?: string;
      cursor?: string;
      take?: number;
    },
  ) {
    const cursor = decodeTimeCursor(filters.cursor);
    const take = Math.min(filters.take ?? 50, 100);
    const items = await this.db.auditEvent.findMany({
      where: {
        tenantId,
        targetType: filters.targetType,
        targetId: filters.targetId,
        actorMembershipId: filters.actorMembershipId,
        ...(cursor
          ? {
              OR: [
                { occurredAt: { lt: cursor.timestamp } },
                { occurredAt: cursor.timestamp, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const hasMore = items.length > take;
    if (hasMore) items.pop();
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeTimeCursor(last.occurredAt, last.id) : null,
    };
  }
}
