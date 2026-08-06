import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;
export const getAttendanceSchedules = (client: ApiClient, tenantId: string, businessDate: string) =>
  client
    .tenant(tenantId)
    .request(`/attendance/schedules?businessDate=${encodeURIComponent(businessDate)}`);
export const getOffCalendar = (client: ApiClient, tenantId: string, businessDate: string) =>
  client
    .tenant(tenantId)
    .request(`/attendance/off-calendar?businessDate=${encodeURIComponent(businessDate)}`);
export const getVideoPolicy = (client: ApiClient, tenantId: string) =>
  client.tenant(tenantId).request<{ id: string; version: number }>('/attendance/video-policies');
export const getPenaltySettlements = (client: ApiClient, tenantId: string, yearMonth: string) =>
  client
    .tenant(tenantId)
    .request(`/attendance/penalty-settlements?yearMonth=${encodeURIComponent(yearMonth)}`);
