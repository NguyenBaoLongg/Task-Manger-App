import { ProblemError } from '@adsup/domain';
import type { BookingRepository } from '@adsup/database';

function parseBusinessDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Ngày nghiệp vụ không hợp lệ.');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export class BookingKpiSourceService {
  constructor(private readonly repository: BookingRepository) {}

  async getCompletedTourCount(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: string;
    asOf: string;
  }) {
    const asOf = new Date(input.asOf);
    if (Number.isNaN(asOf.getTime())) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Mốc dữ liệu KPI không hợp lệ.');
    }
    const businessDate = parseBusinessDate(input.businessDate);
    const rows = await this.repository.getCompletedTours({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: input.branchId,
      businessDate,
      asOf,
    });
    return {
      value: rows.length,
      sourceFreshnessAt: (rows.at(-1)?.completedAt ?? businessDate).toISOString(),
      sourceRefs: rows.map((row) => ({
        type: 'TOUR_COMPLETION' as const,
        id: row.id,
        occurredAt: row.completedAt.toISOString(),
      })),
    };
  }
}
