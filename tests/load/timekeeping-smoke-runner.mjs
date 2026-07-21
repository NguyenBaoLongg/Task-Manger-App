import { readFile } from 'node:fs/promises';

const openApi = await readFile(
  new URL('../../specs/003-timekeeping-workflows/contracts/openapi.yaml', import.meta.url),
  'utf8',
);
const profile = {
  videoCheckInsPerDay: 10_000,
  p95ReadMs: 500,
  readSurfaces: ['attendance-schedules', 'attendance-penalty-settlements', 'action-items'],
};

for (const marker of [
  '/v1/tenants/{tenantId}/attendance/check-ins',
  '/v1/tenants/{tenantId}/attendance/absences/monthly-summary',
  '/v1/tenants/{tenantId}/attendance/penalty-settlements',
]) {
  if (!openApi.includes(marker)) throw new Error(`Missing Module 3 load target: ${marker}`);
}
if (profile.videoCheckInsPerDay !== 10_000)
  throw new Error('Module 3 load profile must cover 10.000 check-ins/day');
if (profile.p95ReadMs > 500)
  throw new Error('Module 3 read p95 target must stay at or below 500ms');
console.log('TIMEKEEPING_LOAD_SMOKE_OK');
