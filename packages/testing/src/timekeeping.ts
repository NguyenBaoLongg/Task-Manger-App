import type { AttendanceBranchId, AttendanceBusinessDate, TenantId } from '@adsup/domain';

export const sampleTimekeepingTenantId: TenantId = '10000000-0000-4000-8000-000000000001';
export const sampleTimekeepingBranchId: AttendanceBranchId = '00000040-0000-4000-8000-000000000001';
export const sampleBusinessDate: AttendanceBusinessDate = '2026-07-21';

export function tenantDate(value: AttendanceBusinessDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function tenantNoon(value: AttendanceBusinessDate): Date {
  return new Date(`${value}T05:00:00.000Z`);
}

export function timekeepingFixture(
  overrides: Partial<{
    tenantId: string;
    branchId: string;
    businessDate: string;
  }> = {},
) {
  return {
    tenantId: overrides.tenantId ?? sampleTimekeepingTenantId,
    branchId: overrides.branchId ?? sampleTimekeepingBranchId,
    businessDate: overrides.businessDate ?? sampleBusinessDate,
    timezone: 'Asia/Ho_Chi_Minh',
  };
}
