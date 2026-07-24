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
        if (row.eventType === 'attendance.checkin-reminder.due') {
          const membershipIds = Array.isArray(payload.mentionMembershipIds)
            ? payload.mentionMembershipIds.filter(
                (item): item is string => typeof item === 'string',
              )
            : [];
          const isFinalReminder = payload.reminderKind === 'NOON_FINAL';
          for (const membershipId of membershipIds) {
            await this.notifications.notify({
              tenantId: row.tenantId,
              membershipId,
              eventId: row.id,
              type: row.eventType,
              dedupeKey: `${row.id}:${membershipId}`,
              title: isFinalReminder ? 'Nhắc check-in lần cuối' : 'Nhắc check-in',
              body: typeof payload.messageBody === 'string' ? payload.messageBody : undefined,
              data: {
                sourceType: 'ATTENDANCE_CHECKIN_REMINDER',
                reminderKind: isFinalReminder ? 'NOON_FINAL' : 'PRE_SHIFT',
                businessDate: typeof payload.businessDate === 'string' ? payload.businessDate : '',
                shiftStartLocalTime:
                  typeof payload.shiftStartLocalTime === 'string'
                    ? payload.shiftStartLocalTime
                    : '',
                cutoffLocalTime:
                  typeof payload.cutoffLocalTime === 'string' ? payload.cutoffLocalTime : '',
              },
            });
          }
        }
        if (row.eventType === 'workflow.step.activated') {
          const membershipIds = stringArray(payload.approverMembershipIds);
          for (const membershipId of membershipIds) {
            await this.notifications.notify({
              tenantId: row.tenantId,
              membershipId,
              eventId: row.id,
              type: row.eventType,
              dedupeKey: `${row.id}:${membershipId}`,
              title: 'Co yeu cau can duyet',
              data: {
                requestId: readString(payload.requestId),
                requestType: readString(payload.requestType),
                sourceType: 'APPROVAL_DECISION_REQUIRED',
              },
            });
          }
        }
        if (row.eventType === 'workflow.request.resolved') {
          const membershipId = payload.requestedByMembershipId;
          if (typeof membershipId === 'string') {
            await this.notifications.notify({
              tenantId: row.tenantId,
              membershipId,
              eventId: row.id,
              type: row.eventType,
              dedupeKey: `${row.id}:${membershipId}`,
              title: 'Yeu cau da duoc xu ly',
              data: {
                requestId: readString(payload.requestId),
                status: readString(payload.status),
              },
            });
          }
        }
        if (row.eventType === 'absence.summary.threshold-exceeded') {
          for (const membershipId of stringArray(payload.managerMembershipIds)) {
            await this.notifications.notify({
              tenantId: row.tenantId,
              membershipId,
              eventId: row.id,
              type: row.eventType,
              dedupeKey: `${row.id}:${membershipId}`,
              title: 'Nhan su nghi qua nguong thang',
              data: {
                summaryId: readString(payload.summaryId),
                employeeMembershipId: readString(payload.membershipId),
                yearMonth: readString(payload.yearMonth),
                sourceType: 'ABSENCE_OVER_THRESHOLD',
              },
            });
          }
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
