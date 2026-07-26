import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@adsup/database';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../apps/api/tests/helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('Module 4 booking database smoke', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  const startAt = new Date('2040-01-01T00:00:00.000Z');
  const endAt = new Date(startAt.getTime() + 20_000 * 2 * 60 * 60_000);

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
    const rows = Array.from({ length: 20_000 }, (_, index) => {
      const scheduledStartAt = new Date(startAt.getTime() + index * 2 * 60 * 60_000);
      return {
        id: randomUUID(),
        tenantId: fixture.tenantId,
        branchId: fixture.branchId,
        customerId: fixture.customerId,
        serviceOfferingId: fixture.serviceOfferingId,
        serviceOfferingVersionId: fixture.serviceOfferingVersionId,
        serviceCodeSnapshot: 'US1_LOAD_SERVICE',
        serviceNameSnapshot: 'US1 load service',
        assignedMembershipId: fixture.membershipId,
        bookingType: 'SCHEDULED' as const,
        scheduledStartAt,
        businessDate: new Date(
          Date.UTC(
            scheduledStartAt.getUTCFullYear(),
            scheduledStartAt.getUTCMonth(),
            scheduledStartAt.getUTCDate(),
          ),
        ),
        timezoneSnapshot: 'Asia/Ho_Chi_Minh',
        status: 'SCHEDULED' as const,
        createdByMembershipId: fixture.membershipId,
      };
    });
    await database.booking.createMany({ data: rows });
    await database.$executeRawUnsafe('ANALYZE "bookings"');
  }, 120_000);

  afterAll(async () => {
    await database.booking.deleteMany({
      where: { tenantId: fixture.tenantId, scheduledStartAt: { gte: startAt, lt: endAt } },
    });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('uses the tenant/branch booking index for a scoped lookup', async () => {
    const planRows = await database.$queryRawUnsafe<Array<{ 'QUERY PLAN': unknown }>>(
      `EXPLAIN (FORMAT JSON)
       SELECT id
       FROM bookings
       WHERE tenant_id = $1::uuid
         AND branch_id = $2::uuid
         AND business_date = $3::date`,
      fixture.tenantId,
      fixture.branchId,
      startAt,
    );
    expect(JSON.stringify(planRows)).toMatch(/Index Only Scan|Index Scan|Bitmap Index Scan/);
  });

  it('aggregates exactly 20,000 rows without crossing tenant scope', async () => {
    const rows = await database.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
       FROM bookings
       WHERE tenant_id = $1::uuid
         AND branch_id = $2::uuid
         AND scheduled_start_at >= $3::timestamptz
         AND scheduled_start_at < $4::timestamptz`,
      fixture.tenantId,
      fixture.branchId,
      startAt,
      endAt,
    );
    expect(Number(rows[0]?.count ?? 0n)).toBe(20_000);

    const otherTenantRows = await database.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
       FROM bookings
       WHERE tenant_id = $1::uuid
         AND scheduled_start_at >= $2::timestamptz
         AND scheduled_start_at < $3::timestamptz`,
      randomUUID(),
      startAt,
      endAt,
    );
    expect(Number(otherTenantRows[0]?.count ?? 0n)).toBe(0);
  });
});
