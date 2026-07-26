import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BookingRepository,
  BookingWorkerRepository,
  createDatabaseClient,
  KpiGovernanceRepository,
  MediaRepository,
  type DatabaseClient,
} from '@adsup/database';
import { MediaService } from '../../../api/src/modules/media/media-service.js';
import { MemoryObjectStorage } from '../../../api/src/modules/media/s3-object-storage.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';
import { PhotoDebtRunner } from '../../src/bookings/photo-debt-runner.js';
import { OutboxDispatcher } from '../../src/outbox/outbox-dispatcher.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking photo-debt media-ready consumer', () => {
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

  it('retries media-ready delivery and resolves debt/action item exactly once', async () => {
    const bookings = new BookingRepository(database);
    const consent = await bookings.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'photo-debt-consent',
    });
    await bookings.recordArrival({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      consentId: consent.id,
      expectedStateVersion: 1,
      correlationId: 'photo-debt-arrival',
    });
    const storage = new MemoryObjectStorage();
    const media = new MediaService(new MediaRepository(database), storage, 'booking-test', 300, {
      hasPermission: async () => true,
    } as never);
    const intent = await media.createIntent({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      branchId: fixture.branchId,
      sourceType: 'BOOKING',
      sourceId: fixture.bookingId,
      purpose: 'CUSTOMER_BOOKING_PHOTO',
      consentId: consent.id,
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'b'.repeat(64),
      correlationId: 'photo-debt-intent',
    });
    storage.put(intent.media.objectKey, {
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'b'.repeat(64),
    });
    await media.complete(
      fixture.tenantId,
      intent.media.id,
      fixture.membershipId,
      'photo-debt-ready',
    );
    await database.outboxEvent.updateMany({
      where: {
        tenantId: fixture.tenantId,
        eventType: { not: 'media.ready.v1' },
      },
      data: { status: 'SENT', sentAt: new Date() },
    });
    const runner = new PhotoDebtRunner(new BookingWorkerRepository(database));
    let attempt = 0;
    const consumer = {
      async handle(event: Parameters<PhotoDebtRunner['handle']>[0]) {
        attempt += 1;
        if (attempt === 1) throw new Error('transient');
        return runner.handle(event);
      },
    };
    const dispatcher = new OutboxDispatcher(
      new KpiGovernanceRepository(database),
      { publishActionItemChanged: async () => {}, publishProgressChanged: async () => {} },
      { notify: async () => {} },
      10,
      consumer,
    );
    await expect(dispatcher.dispatch('booking-photo-worker')).resolves.toMatchObject({
      sent: 0,
      failed: 1,
    });
    await database.outboxEvent.updateMany({
      where: { tenantId: fixture.tenantId, eventType: 'media.ready.v1' },
      data: { availableAt: new Date('2000-01-01T00:00:00.000Z') },
    });
    await expect(dispatcher.dispatch('booking-photo-worker')).resolves.toMatchObject({
      sent: 1,
      failed: 0,
    });

    expect(
      await database.customerPhotoDebt.findUniqueOrThrow({
        where: {
          tenantId_bookingId: {
            tenantId: fixture.tenantId,
            bookingId: fixture.bookingId,
          },
        },
      }),
    ).toMatchObject({ state: 'RESOLVED', resolvedMediaId: intent.media.id, stateVersion: 2 });
    const resolvedDebt = await database.customerPhotoDebt.findUniqueOrThrow({
      where: {
        tenantId_bookingId: {
          tenantId: fixture.tenantId,
          bookingId: fixture.bookingId,
        },
      },
    });
    expect(resolvedDebt).toMatchObject({
      openedByMembershipId: fixture.membershipId,
      openedReason: 'ARRIVED_WITHOUT_CUSTOMER_PHOTO',
      resolvedByMembershipId: null,
      resolutionReason: 'CUSTOMER_PHOTO_MEDIA_READY',
    });
    expect(
      await database.actionItem.findFirstOrThrow({
        where: { tenantId: fixture.tenantId, itemType: 'PHOTO_DEBT' },
      }),
    ).toMatchObject({ state: 'COMPLETED' });
    await expect(dispatcher.dispatch('booking-photo-worker')).resolves.toMatchObject({
      claimed: 2,
      sent: 2,
      failed: 0,
    });
    expect(attempt).toBe(2);
    await expect(dispatcher.dispatch('booking-photo-worker')).resolves.toMatchObject({
      claimed: 0,
    });
  });
});
