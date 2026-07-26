import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { BookingKpiSourceService } from '../../src/modules/bookings/booking-kpi-source-service.js';
import { KpiSourceService } from '../../src/modules/kpi/kpi-source-service.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  scheduledBookingInput,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking tour completion KPI source', () => {
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

  it('uses committed, active TourCompletion rows as the authoritative Module 2 source', async () => {
    const repository = new BookingRepository(database);
    const consent = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      method: 'WRITTEN',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'tour-consent',
    });
    const photo = await database.mediaObject.create({
      data: {
        tenantId: fixture.tenantId,
        ownerMembershipId: fixture.membershipId,
        branchId: fixture.branchId,
        sourceType: 'BOOKING',
        sourceId: fixture.bookingId,
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        consentId: consent.id,
        storageProvider: 'memory',
        bucket: 'booking-test',
        objectKey: `${fixture.tenantId}/tour-photo`,
        contentType: 'image/jpeg',
        byteSize: 100n,
        checksumSha256: 'c'.repeat(64),
        status: 'READY',
        uploadExpiresAt: new Date('2031-01-15T03:00:00.000Z'),
        readyAt: new Date('2031-01-15T01:50:00.000Z'),
      },
    });
    const arrived = await repository.recordArrival({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      consentId: consent.id,
      customerPhotoMediaId: photo.id,
      expectedStateVersion: 1,
      correlationId: 'tour-arrival',
    });
    const completion = await repository.completeTour({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      performedByMembershipId: fixture.membershipId,
      customerPhotoMediaId: photo.id,
      expectedBookingStateVersion: arrived.booking.stateVersion,
      correlationId: 'tour-complete',
    });
    const source = new BookingKpiSourceService(repository);
    const snapshot = await source.getCompletedTourCount({
      tenantId: fixture.tenantId,
      membershipId: fixture.membershipId,
      branchId: fixture.branchId,
      businessDate: '2031-01-15',
      asOf: new Date(completion.completedAt.getTime() + 1_000).toISOString(),
    });
    expect(snapshot.value).toBe(1);
    expect(snapshot.sourceRefs).toEqual([
      {
        type: 'TOUR_COMPLETION',
        id: completion.id,
        occurredAt: completion.completedAt.toISOString(),
      },
    ]);
    const module2Source = new KpiSourceService({ read: async () => null }, undefined, source);
    await expect(
      module2Source.read({
        tenantId: fixture.tenantId,
        membershipId: fixture.membershipId,
        branchId: fixture.branchId,
        businessDate: '2031-01-15',
        kpiCode: 'BOOKING_COMPLETED_TOURS',
        mapping: {
          id: '80000000-0000-4000-8000-000000000008',
          sourceType: 'DOMAIN_ADAPTER',
          adapterCode: 'BOOKING_COMPLETED_TOURS',
        },
        submission: null,
      } as never),
    ).resolves.toMatchObject({
      sourceType: 'DOMAIN',
      sourceId: completion.id,
      value: '1',
      unit: 'TOUR',
    });
    await database.tourCompletion.update({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: completion.id } },
      data: { supersededAt: new Date() },
    });
    await expect(
      source.getCompletedTourCount({
        tenantId: fixture.tenantId,
        membershipId: fixture.membershipId,
        branchId: fixture.branchId,
        businessDate: '2031-01-15',
        asOf: new Date(Date.now() + 1_000).toISOString(),
      }),
    ).resolves.toMatchObject({ value: 0, sourceRefs: [] });
  });

  it('commits one tour, closes one debt and emits one event under PostgreSQL concurrency', async () => {
    const repository = new BookingRepository(database);
    const booking = await repository.createScheduledBooking(
      scheduledBookingInput(fixture, {
        scheduledStartAt: new Date('2031-01-15T04:00:00.000Z'),
      }),
    );
    if (!booking) throw new Error('Failed to create concurrent tour booking');
    const consent = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'tour-concurrency-consent',
    });
    const arrived = await repository.recordArrival({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      consentId: consent.id,
      expectedStateVersion: 1,
      correlationId: 'tour-concurrency-arrival',
    });
    const photo = await database.mediaObject.create({
      data: {
        tenantId: fixture.tenantId,
        ownerMembershipId: fixture.membershipId,
        branchId: fixture.branchId,
        sourceType: 'BOOKING',
        sourceId: booking.id,
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        consentId: consent.id,
        storageProvider: 'memory',
        bucket: 'booking-test',
        objectKey: `${fixture.tenantId}/tour-concurrency-photo`,
        contentType: 'image/jpeg',
        byteSize: 100n,
        checksumSha256: 'f'.repeat(64),
        status: 'READY',
        uploadExpiresAt: new Date('2031-01-15T03:00:00.000Z'),
        readyAt: new Date('2031-01-15T01:50:00.000Z'),
      },
    });
    const contenders = [createDatabaseClient(databaseUrl!), createDatabaseClient(databaseUrl!)];
    try {
      const results = await Promise.all(
        contenders.map((client) =>
          new BookingRepository(client).completeTour({
            tenantId: fixture.tenantId,
            bookingId: booking.id,
            performedByMembershipId: fixture.membershipId,
            customerPhotoMediaId: photo.id,
            expectedBookingStateVersion: arrived.booking.stateVersion,
            correlationId: 'tour-concurrency-complete',
          }),
        ),
      );
      expect(new Set(results.map((item) => item.id)).size).toBe(1);
      expect(
        await database.tourCompletion.count({
          where: { tenantId: fixture.tenantId, bookingId: booking.id, supersededAt: null },
        }),
      ).toBe(1);
      expect(
        await database.customerPhotoDebt.count({
          where: { tenantId: fixture.tenantId, bookingId: booking.id, state: 'RESOLVED' },
        }),
      ).toBe(1);
      expect(
        await database.outboxEvent.count({
          where: {
            tenantId: fixture.tenantId,
            eventType: 'booking.tour-completed.v1',
            aggregateId: booking.id,
          },
        }),
      ).toBe(1);
    } finally {
      await Promise.all(contenders.map((client) => client.$disconnect()));
    }
  });

  it('rejects a conflicting duplicate tour payload after the first completion', async () => {
    const repository = new BookingRepository(database);
    const booking = await repository.createScheduledBooking(
      scheduledBookingInput(fixture, {
        scheduledStartAt: new Date('2031-01-15T06:00:00.000Z'),
      }),
    );
    if (!booking) throw new Error('Failed to create conflicting tour booking');
    const consent = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'tour-conflict-consent',
    });
    const arrived = await repository.recordArrival({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      consentId: consent.id,
      expectedStateVersion: 1,
      correlationId: 'tour-conflict-arrival',
    });
    const photos = await Promise.all(
      ['1', '2'].map((suffix) =>
        database.mediaObject.create({
          data: {
            tenantId: fixture.tenantId,
            ownerMembershipId: fixture.membershipId,
            branchId: fixture.branchId,
            sourceType: 'BOOKING',
            sourceId: booking.id,
            purpose: 'CUSTOMER_BOOKING_PHOTO',
            consentId: consent.id,
            storageProvider: 'memory',
            bucket: 'booking-test',
            objectKey: `${fixture.tenantId}/tour-conflict-photo-${suffix}`,
            contentType: 'image/jpeg',
            byteSize: 100n,
            checksumSha256: suffix.repeat(64),
            status: 'READY',
            uploadExpiresAt: new Date('2031-01-15T03:00:00.000Z'),
            readyAt: new Date('2031-01-15T01:50:00.000Z'),
          },
        }),
      ),
    );
    await repository.completeTour({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      performedByMembershipId: fixture.membershipId,
      customerPhotoMediaId: photos[0]!.id,
      expectedBookingStateVersion: arrived.booking.stateVersion,
      correlationId: 'tour-conflict-first',
    });
    await expect(
      repository.completeTour({
        tenantId: fixture.tenantId,
        bookingId: booking.id,
        performedByMembershipId: fixture.membershipId,
        customerPhotoMediaId: photos[1]!.id,
        expectedBookingStateVersion: arrived.booking.stateVersion,
        correlationId: 'tour-conflict-second',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
