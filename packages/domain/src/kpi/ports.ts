import type { Clock, TenantId, UUID } from '../foundation.js';
import type { KpiSourceQuery, KpiSourceSnapshot } from './types.js';

export type KpiClock = Clock;
export const KPI_REALTIME_CHANNEL = 'adsup:kpi:realtime:v1';

export interface KpiSourcePort {
  read(query: KpiSourceQuery): Promise<KpiSourceSnapshot | null>;
}

export interface KpiRealtimeEffectPort {
  publishActionItemChanged(input: {
    tenantId: TenantId;
    membershipId: UUID;
    actionItemId: UUID;
    stateVersion: number;
  }): Promise<void>;
  publishProgressChanged(input: {
    tenantId: TenantId;
    membershipId: UUID;
    reportId: UUID;
    kpiDefinitionId: UUID;
  }): Promise<void>;
}

export interface KpiNotificationEffectPort {
  notify(input: {
    tenantId: TenantId;
    membershipId: UUID;
    eventId: UUID;
    type: string;
    dedupeKey?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
  }): Promise<void>;
}
