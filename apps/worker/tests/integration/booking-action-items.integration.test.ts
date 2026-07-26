import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BookingWorkerRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';
import { BookingActionItemRunner } from '../../src/bookings/action-item-runner.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking action item reconciliation', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });
  afterAll(async () => {
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('projects overdue missing-status items idempotently across retries', async () => {
    const runner = new BookingActionItemRunner(new BookingWorkerRepository(database));
    const now = new Date('2031-01-16T03:00:00.000Z');
    expect(await database.tenant.count({ where: { id: fixture.tenantId } })).toBe(1);
    expect(await database.booking.count({ where: { tenantId: fixture.tenantId } })).toBe(1);
    const first = await runner.run(now);
    const second = await runner.run(now);
    expect(first[0]?.processed).toBeGreaterThan(0);
    expect(second[0]?.processed).toBeGreaterThan(0);
    expect(
      await database.actionItem.count({
        where: { tenantId: fixture.tenantId, sourceType: 'BOOKING_MISSING_STATUS' },
      }),
    ).toBe(1);
    expect(
      await database.actionItemTransition.count({ where: { tenantId: fixture.tenantId } }),
    ).toBeGreaterThan(0);
  });
});
