import type { KpiNotificationEffectPort, KpiRealtimeEffectPort } from '@adsup/domain';
import type { KpiGovernanceRepository } from '@adsup/database';

export class OutboxDispatcher {
  constructor(
    private readonly repository: KpiGovernanceRepository,
    private readonly realtime: KpiRealtimeEffectPort,
    private readonly notifications: KpiNotificationEffectPort,
    private readonly maxAttempts = 10,
  ) {}

  async dispatch(workerId: string, now = new Date(), limit = 100) {
    const rows = await this.repository.claimOutbox({
      workerId,
      now,
      leaseUntil: new Date(now.getTime() + 30_000),
      limit,
    });
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const payload = row.payloadRedacted as Record<string, unknown>;
        if (row.eventType === 'action-item.changed') {
          await this.realtime.publishActionItemChanged({
            tenantId: row.tenantId,
            membershipId: String(payload.ownerMembershipId),
            actionItemId: row.aggregateId,
            stateVersion: Number(payload.stateVersion ?? 1),
          });
        }
        if (row.eventType === 'kpi.progress.changed') {
          await this.realtime.publishProgressChanged({
            tenantId: row.tenantId,
            membershipId: String(payload.membershipId),
            reportId: String(payload.reportId),
            kpiDefinitionId: String(payload.kpiDefinitionId),
          });
        }
        if (row.eventType.includes('penalty') || row.eventType.includes('evidence')) {
          const membershipId = payload.membershipId;
          if (typeof membershipId === 'string') {
            await this.notifications.notify({
              tenantId: row.tenantId,
              membershipId,
              eventId: row.id,
              type: row.eventType,
            });
          }
        }
        await this.repository.markOutboxSent(row.tenantId, row.id, workerId, new Date());
        sent += 1;
      } catch (error) {
        failed += 1;
        const deadLetter = row.attempt >= this.maxAttempts;
        const delay = Math.min(300_000, 1_000 * 2 ** Math.min(row.attempt, 8));
        await this.repository.markOutboxFailed({
          tenantId: row.tenantId,
          id: row.id,
          workerId,
          availableAt: new Date(Date.now() + delay),
          safeError: error instanceof Error ? error.name : 'DELIVERY_FAILED',
          deadLetter,
        });
      }
    }
    return { claimed: rows.length, sent, failed };
  }
}
