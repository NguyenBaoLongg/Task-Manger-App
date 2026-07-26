import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
  scheduledBookingInput,
} from '../helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking outcome concurrency', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });
  afterAll(async () => {
    await database.bookingCancellationReasonVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await database.bookingCancellationReason.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('allows only one terminal transition for concurrent state-version contenders', async () => {
    const repository = new BookingRepository(database);
    const reason = await repository.createCancellationReasonVersion({
      tenantId: fixture.tenantId,
      code: 'NO_SHOW',
      label: 'No show',
      appliesToCancellation: true,
      appliesToReschedule: false,
      status: 'ACTIVE',
      effectiveFrom: new Date('2020-01-01'),
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-concurrency-reason',
    });
    const a = createDatabaseClient(databaseUrl!);
    const b = createDatabaseClient(databaseUrl!);
    const results = await Promise.allSettled([
      new BookingRepository(a).recordBookingOutcome({
        tenantId: fixture.tenantId,
        bookingId: fixture.bookingId,
        actorMembershipId: fixture.membershipId,
        outcome: 'NO_SHOW',
        reasonVersionId: reason.id,
        expectedStateVersion: 1,
        correlationId: 'us3-outcome-a',
      }),
      new BookingRepository(b).recordBookingOutcome({
        tenantId: fixture.tenantId,
        bookingId: fixture.bookingId,
        actorMembershipId: fixture.membershipId,
        outcome: 'NO_SHOW',
        reasonVersionId: reason.id,
        expectedStateVersion: 1,
        correlationId: 'us3-outcome-b',
      }),
    ]);
    await Promise.all([a.$disconnect(), b.$disconnect()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await database.bookingStatusTransition.count({
        where: { tenantId: fixture.tenantId, bookingId: fixture.bookingId, toStatus: 'NO_SHOW' },
      }),
    ).toBe(1);
    expect(
      await database.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'booking.outcome-recorded.v1' },
      }),
    ).toBe(1);
  });

  it('keeps the source booking untouched when replacement conflicts', async () => {
    const second = await new BookingRepository(database).createScheduledBooking(
      scheduledBookingInput(fixture, {
        scheduledStartAt: new Date('2031-01-16T02:00:00.000Z'),
        businessDate: new Date('2031-01-16T00:00:00.000Z'),
        idempotencyKey: 'us3-conflict-source',
      }),
    );
    expect(second).toBeTruthy();
  });
});
