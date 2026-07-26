import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking ARRIVED PostgreSQL concurrency', () => {
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

  it('creates one ARRIVED transition, debt and action item under concurrent retries', async () => {
    const consent = await new BookingRepository(database).recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'arrival-race-consent',
    });
    const contenderA = createDatabaseClient(databaseUrl!);
    const contenderB = createDatabaseClient(databaseUrl!);
    const base = {
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      consentId: consent.id,
      expectedStateVersion: 1,
    };
    const results = await Promise.all([
      new BookingRepository(contenderA).recordArrival({
        ...base,
        correlationId: 'arrival-race-a',
      }),
      new BookingRepository(contenderB).recordArrival({
        ...base,
        correlationId: 'arrival-race-b',
      }),
    ]);
    await Promise.all([contenderA.$disconnect(), contenderB.$disconnect()]);

    expect(results.every((result) => result.booking.status === 'ARRIVED')).toBe(true);
    expect(
      await database.bookingStatusTransition.count({
        where: { tenantId: fixture.tenantId, bookingId: fixture.bookingId, toStatus: 'ARRIVED' },
      }),
    ).toBe(1);
    expect(
      await database.customerPhotoDebt.count({
        where: { tenantId: fixture.tenantId, bookingId: fixture.bookingId },
      }),
    ).toBe(1);
    expect(
      await database.actionItem.count({
        where: { tenantId: fixture.tenantId, itemType: 'PHOTO_DEBT' },
      }),
    ).toBe(1);
  });
});
