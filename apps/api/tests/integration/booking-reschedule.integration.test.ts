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

live('booking reschedule PostgreSQL transactions', () => {
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

  it('rolls back on conflict and lets only one concurrent replacement commit', async () => {
    const repository = new BookingRepository(database);
    const reason = await repository.createCancellationReasonVersion({
      tenantId: fixture.tenantId,
      code: 'CHANGE_TIME',
      label: 'Change time',
      appliesToCancellation: false,
      appliesToReschedule: true,
      status: 'ACTIVE',
      effectiveFrom: new Date('2020-01-01'),
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-reschedule-reason',
    });
    const blocker = await repository.createScheduledBooking(
      scheduledBookingInput(fixture, {
        scheduledStartAt: new Date('2031-01-16T02:00:00.000Z'),
        businessDate: new Date('2031-01-16T00:00:00.000Z'),
        idempotencyKey: 'us3-reschedule-blocker',
      }),
    );
    expect(blocker).toBeTruthy();
    expect(await database.booking.count({ where: { tenantId: fixture.tenantId } })).toBe(2);
    await expect(
      repository.rescheduleBooking({
        tenantId: fixture.tenantId,
        bookingId: fixture.bookingId,
        actorMembershipId: fixture.membershipId,
        scheduledStartAt: new Date('2031-01-16T02:00:00.000Z'),
        assignedMembershipId: fixture.membershipId,
        reasonVersionId: reason.id,
        expectedStateVersion: 1,
        correlationId: 'us3-reschedule-conflict',
      }),
    ).rejects.toBeDefined();
    const verifyDatabase = createDatabaseClient(databaseUrl!);
    const sourceAfterConflict = await verifyDatabase.booking.findMany({
      where: { tenantId: fixture.tenantId },
      select: { id: true, status: true, rescheduledToId: true },
    });
    expect(sourceAfterConflict.find((booking) => booking.id === fixture.bookingId)).toMatchObject({
      status: 'SCHEDULED',
      rescheduledToId: null,
    });
    await verifyDatabase.$disconnect();
    const a = createDatabaseClient(databaseUrl!);
    const b = createDatabaseClient(databaseUrl!);
    const input = {
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      scheduledStartAt: new Date('2031-01-17T02:00:00.000Z'),
      assignedMembershipId: fixture.membershipId,
      reasonVersionId: reason.id,
      expectedStateVersion: 1,
    };
    const results = await Promise.allSettled([
      new BookingRepository(a).rescheduleBooking({ ...input, correlationId: 'us3-reschedule-a' }),
      new BookingRepository(b).rescheduleBooking({ ...input, correlationId: 'us3-reschedule-b' }),
    ]);
    await Promise.all([a.$disconnect(), b.$disconnect()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await database.booking.count({
        where: { tenantId: fixture.tenantId, rescheduledFromId: fixture.bookingId },
      }),
    ).toBe(1);
    expect(
      await database.bookingStatusTransition.count({
        where: {
          tenantId: fixture.tenantId,
          bookingId: fixture.bookingId,
          toStatus: 'RESCHEDULED',
        },
      }),
    ).toBe(1);
  });
});
