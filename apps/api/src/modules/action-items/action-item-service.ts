import type { ActionItemRepository } from '@adsup/database';

export class ActionItemService {
  constructor(private readonly repository: ActionItemRepository) {}

  projectKpiReport(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    departmentId?: string | null;
    businessDate: Date;
    reportId: string;
    submitted: boolean;
    deadlineAt: Date;
    sourceFreshnessAt: Date;
    correlationId: string;
    eventId?: string;
  }) {
    return this.repository.project({
      tenantId: input.tenantId,
      ownerMembershipId: input.membershipId,
      branchId: input.branchId,
      departmentId: input.departmentId,
      itemType: 'KPI_REPORT',
      sourceType: 'DAILY_KPI_REPORT',
      sourceId: input.reportId,
      businessDate: input.businessDate,
      state: input.submitted ? 'COMPLETED' : new Date() > input.deadlineAt ? 'OVERDUE' : 'OPEN',
      title: input.submitted ? 'Báo cáo KPI đã nộp' : 'Chưa nộp báo cáo KPI hằng ngày',
      targetValue: '1',
      actualValue: input.submitted ? '1' : '0',
      remainingValue: input.submitted ? '0' : '1',
      unit: 'REPORT',
      deadlineAt: input.deadlineAt,
      sourceFreshnessAt: input.sourceFreshnessAt,
      deepLink: `adsup://kpi/reports/${input.businessDate.toISOString().slice(0, 10)}`,
      correlationId: input.correlationId,
      eventId: input.eventId,
    });
  }

  projectKpiShortfall(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    departmentId?: string | null;
    businessDate: Date;
    reportId: string;
    kpiDefinitionId: string;
    definitionName: string;
    target: string;
    actual: string | null;
    remaining: string;
    unit: string;
    deadlineAt: Date;
    sourceFreshnessAt: Date;
    passed: boolean;
    correlationId: string;
    eventId?: string;
  }) {
    return this.repository.project({
      tenantId: input.tenantId,
      ownerMembershipId: input.membershipId,
      branchId: input.branchId,
      departmentId: input.departmentId,
      itemType: 'KPI_SHORTFALL',
      sourceType: 'KPI_DEFINITION',
      sourceId: input.kpiDefinitionId,
      businessDate: input.businessDate,
      state: input.passed ? 'COMPLETED' : new Date() > input.deadlineAt ? 'OVERDUE' : 'OPEN',
      title: input.passed ? `${input.definitionName} đã đạt` : `${input.definitionName} còn thiếu`,
      targetValue: input.target,
      actualValue: input.actual,
      remainingValue: input.remaining,
      unit: input.unit,
      deadlineAt: input.deadlineAt,
      sourceFreshnessAt: input.sourceFreshnessAt,
      deepLink: `adsup://kpi/reports/${input.businessDate.toISOString().slice(0, 10)}?kpi=${input.kpiDefinitionId}`,
      correlationId: input.correlationId,
      eventId: input.eventId,
    });
  }

  listMine(input: Parameters<ActionItemRepository['listMine']>[0]) {
    return this.repository.listMine(input);
  }

  listManaged(input: Parameters<ActionItemRepository['listManaged']>[0]) {
    return this.repository.listManaged(input);
  }
}
