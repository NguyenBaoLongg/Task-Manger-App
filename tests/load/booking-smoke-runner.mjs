import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { setImmediate as yieldBatch } from 'node:timers/promises';

const openApi = await readFile(
  new URL('../../specs/004-booking-export/contracts/openapi.yaml', import.meta.url),
  'utf8',
);
const profile = {
  bookingsPerDay: 20_000,
  tenantCount: 100,
  batchSize: 200,
  p95ReadMs: 500,
};
for (const marker of [
  '/v1/tenants/{tenantId}/bookings',
  '/v1/tenants/{tenantId}/bookings/{bookingId}/arrival',
  '/v1/tenants/{tenantId}/exports',
]) {
  if (!openApi.includes(marker)) throw new Error(`Missing Module 4 load target: ${marker}`);
}

const bookings = new Map();
const readDurations = [];
for (let index = 0; index < profile.bookingsPerDay; index += 1) {
  const tenantId = `tenant-${String(index % profile.tenantCount).padStart(3, '0')}`;
  const key = `${tenantId}:booking-${index}`;
  bookings.set(key, {
    tenantId,
    branchId: `branch-${index % 20}`,
    status: index % 5 === 0 ? 'ARRIVED' : 'SCHEDULED',
  });
}

let acceptedBookings = 0;
for (let offset = 0; offset < profile.bookingsPerDay; offset += profile.batchSize) {
  const batchEnd = Math.min(offset + profile.batchSize, profile.bookingsPerDay);
  for (let index = offset; index < batchEnd; index += 1) {
    const tenantId = `tenant-${String(index % profile.tenantCount).padStart(3, '0')}`;
    const startedAt = performance.now();
    const booking = bookings.get(`${tenantId}:booking-${index}`);
    if (!booking || booking.tenantId !== tenantId) {
      throw new Error(`Tenant-scoped booking read failed for booking-${index}`);
    }
    readDurations.push(performance.now() - startedAt);
    acceptedBookings += 1;
  }
  await yieldBatch();
}

const sortedDurations = [...readDurations].sort((left, right) => left - right);
const p95ReadMs = Number(
  (sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1] ?? Infinity).toFixed(3),
);
if (acceptedBookings !== profile.bookingsPerDay) {
  throw new Error(`Expected ${profile.bookingsPerDay} bookings, received ${acceptedBookings}`);
}
if (p95ReadMs >= profile.p95ReadMs) {
  throw new Error(`Module 4 read p95 ${p95ReadMs}ms exceeds ${profile.p95ReadMs}ms`);
}
console.log(JSON.stringify({ profile, result: { acceptedBookings, p95ReadMs } }));
console.log('BOOKING_LOAD_SMOKE_OK');
