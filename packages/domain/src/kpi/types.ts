import type { MembershipId, TenantId, UUID } from '../foundation.js';

export type KpiDefinitionId = UUID;
export type BranchId = UUID;
export type BusinessDate = string;
export type KpiValueType = 'MONEY' | 'COUNT' | 'PERCENTAGE';
export type KpiDirection = 'AT_LEAST' | 'AT_MOST';
export type KpiSourceType = 'FORM_FIELD' | 'DOMAIN_ADAPTER';
export type KpiScopeType = 'TENANT' | 'BRANCH' | 'DEPARTMENT' | 'GROUP' | 'MEMBERSHIP';
export type EvaluationStatus = 'PASSED' | 'FAILED' | 'EXEMPT';
export type EvidenceDebtStatus = 'WAITING_PHOTOS' | 'SATISFIED' | 'OVERDUE' | 'WAIVED';
export type ActionItemState = 'OPEN' | 'OVERDUE' | 'COMPLETED' | 'DISMISSED';
export type ActionItemType = 'KPI_REPORT' | 'KPI_SHORTFALL' | 'PHOTO_DEBT' | 'DATA_QUALITY';

export interface ExactMetricValue {
  valueType: KpiValueType;
  atomic: bigint;
  scale: 0 | 4;
  unit: string;
}

export interface EffectiveAssignment {
  tenantId: TenantId;
  membershipId: MembershipId;
  branchId: BranchId;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
}

export interface EffectiveVersionRange {
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export interface TargetCandidate extends EffectiveVersionRange {
  id: UUID;
  kpiDefinitionId: KpiDefinitionId;
  scopeType: KpiScopeType;
  scopeId?: UUID | null;
  versionNumber: number;
}

export interface PolicyCandidate {
  id: UUID;
  scopeType: 'TENANT' | 'BRANCH';
  branchId?: BranchId | null;
  effectiveFromDate: BusinessDate;
  effectiveToDate?: BusinessDate | null;
  versionNumber: number;
  timezone: string;
  reportOpenLocal: string;
  reportCloseLocal: string;
  evaluationLocal: string;
}

export interface DailyPolicyInstants {
  openedAt: Date;
  closedAt: Date;
  evaluationAt: Date;
}

export interface KpiProgressDetail {
  kpiDefinitionId: KpiDefinitionId;
  required: boolean;
  passed: boolean;
  target: ExactMetricValue;
  actual: ExactMetricValue | null;
  remaining: ExactMetricValue;
  sourceStatus: 'FRESH' | 'STALE' | 'MISSING' | 'ERROR';
}

export interface KpiSourceQuery {
  tenantId: TenantId;
  membershipId: MembershipId;
  branchId: BranchId;
  businessDate: BusinessDate;
  kpiCode: string;
  mappingVersionId: UUID;
}

export interface KpiSourceSnapshot {
  sourceType: 'FORM_SUBMISSION' | 'ATTENDANCE' | 'DOMAIN';
  sourceId: UUID;
  observedAt: Date;
  value: string;
  unit: string;
  inputDigest: string;
}
