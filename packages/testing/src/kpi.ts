import type {
  KpiNotificationEffectPort,
  KpiRealtimeEffectPort,
  KpiSourcePort,
  KpiSourceQuery,
  KpiSourceSnapshot,
} from '@adsup/domain';

export class InMemoryKpiSource implements KpiSourcePort {
  private readonly values = new Map<string, KpiSourceSnapshot>();

  set(query: KpiSourceQuery, snapshot: KpiSourceSnapshot) {
    this.values.set(this.key(query), snapshot);
  }

  async read(query: KpiSourceQuery): Promise<KpiSourceSnapshot | null> {
    return this.values.get(this.key(query)) ?? null;
  }

  private key(query: KpiSourceQuery) {
    return [
      query.tenantId,
      query.membershipId,
      query.branchId,
      query.businessDate,
      query.kpiCode,
      query.mappingVersionId,
    ].join(':');
  }
}

export class CollectingKpiEffects implements KpiRealtimeEffectPort, KpiNotificationEffectPort {
  readonly realtime: unknown[] = [];
  readonly notifications: unknown[] = [];

  async publishActionItemChanged(input: unknown) {
    this.realtime.push(input);
  }

  async publishProgressChanged(input: unknown) {
    this.realtime.push(input);
  }

  async notify(input: unknown) {
    this.notifications.push(input);
  }
}
