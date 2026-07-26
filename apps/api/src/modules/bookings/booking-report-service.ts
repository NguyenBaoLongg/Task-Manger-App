import { ProblemError } from '@adsup/domain';
import type { BookingAuthorization } from './customer-service.js';

type ReportType = 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
type Destination = { branchId?: string; reportType: ReportType; chatChannelId: string };
type BookingReportRepository = {
  listBookingReportDestinations(input: {
    tenantId: string;
  }): Promise<Array<{ branchId: string | null; reportType: ReportType; chatChannelId: string }>>;
  replaceBookingReportDestinations(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    items: Destination[];
  }): Promise<unknown>;
  enqueueReportRerun(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    reportType: ReportType;
    businessDate: Date;
    branchIds?: string[];
    reason: string;
  }): Promise<unknown>;
};

function allowed(scope: { tenantWide: boolean; branchIds: string[] }, branchId?: string) {
  return scope.tenantWide || (!!branchId && scope.branchIds.includes(branchId));
}

export class BookingReportService {
  constructor(
    private readonly repository: BookingReportRepository,
    private readonly authorization: BookingAuthorization,
  ) {}

  async listDestinations(input: { tenantId: string; actorMembershipId: string }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.read',
    );
    const rows = await this.repository.listBookingReportDestinations({ tenantId: input.tenantId });
    return rows.filter((row: { branchId: string | null }) =>
      row.branchId ? allowed(scope, row.branchId) : scope.tenantWide,
    );
  }

  async replaceDestinations(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    items: Destination[];
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.manage',
    );
    if (input.items.some((item) => !allowed(scope, item.branchId))) {
      throw new ProblemError(
        403,
        'AUTHORIZATION_DENIED',
        'Report branch is outside the actor scope.',
      );
    }
    return this.repository.replaceBookingReportDestinations(input);
  }

  async rerun(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    reportType: ReportType;
    businessDate: string;
    branchIds?: string[];
    reason: string;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.report.rerun',
    );
    if (
      !scope.tenantWide &&
      (!input.branchIds?.length ||
        input.branchIds.some((branchId) => !scope.branchIds.includes(branchId)))
    ) {
      throw new ProblemError(
        403,
        'AUTHORIZATION_DENIED',
        'Report branch is outside the actor scope.',
      );
    }
    return this.repository.enqueueReportRerun({
      ...input,
      businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
    });
  }
}
