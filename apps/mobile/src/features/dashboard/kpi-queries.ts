import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export type ExactValue = {
  value: string;
  unit: string;
};

export type KpiProgress = {
  businessDate: string;
  reportStatus: 'OPEN' | 'SUBMITTED' | 'LATE' | 'CLOSED';
  openedAt: string;
  closedAt: string;
  items: Array<{
    kpiDefinitionId: string;
    name: string;
    target: ExactValue;
    actual: ExactValue | null;
    remaining: ExactValue;
    passed: boolean;
    required: boolean;
    sourceStatus: 'FRESH' | 'STALE' | 'MISSING' | 'ERROR';
    sourceObservedAt?: string | null;
    deadlineAt: string;
    deepLink?: string;
  }>;
};

export const getDailyKpiProgress = (client: ApiClient, tenantId: string, businessDate: string) =>
  client
    .tenant(tenantId)
    .request<KpiProgress>(`/kpi/reports/${encodeURIComponent(businessDate)}/progress`);
