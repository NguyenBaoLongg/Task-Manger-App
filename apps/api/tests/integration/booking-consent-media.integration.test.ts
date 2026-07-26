import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingCustomerPhotoReadyEventSchema } from '@adsup/contracts';
import {
  BookingRepository,
  createDatabaseClient,
  MediaRepository,
  type DatabaseClient,
} from '@adsup/database';
import { MediaService } from '../../src/modules/media/media-service.js';
import { MemoryObjectStorage } from '../../src/modules/media/s3-object-storage.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  scheduledBookingInput,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking consent and customer-photo media', () => {
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

  it('requires same-scope consent before upload and READY media before photo-backed arrival', async () => {
    const bookingRepository = new BookingRepository(database);
    const mediaRepository = new MediaRepository(database);
    const storage = new MemoryObjectStorage();
    const media = new MediaService(mediaRepository, storage, 'booking-test', 300, {
      hasPermission: async () => true,
    } as never);
    const uploadInput = {
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      branchId: fixture.branchId,
      sourceType: 'BOOKING',
      sourceId: fixture.bookingId,
      purpose: 'CUSTOMER_BOOKING_PHOTO',
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'a'.repeat(64),
      correlationId: 'booking-consent-media',
    };
    await expect(media.createIntent(uploadInput)).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
    const consent = await bookingRepository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'booking-consent',
    });
    const intent = await media.createIntent({ ...uploadInput, consentId: consent.id });
    await expect(
      bookingRepository.recordArrival({
        tenantId: fixture.tenantId,
        bookingId: fixture.bookingId,
        actorMembershipId: fixture.membershipId,
        consentId: consent.id,
        customerPhotoMediaId: intent.media.id,
        expectedStateVersion: 1,
        correlationId: 'booking-arrival-pending',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });

    storage.put(intent.media.objectKey, {
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'a'.repeat(64),
    });
    await media.complete(
      fixture.tenantId,
      intent.media.id,
      fixture.membershipId,
      'booking-media-ready',
    );
    await expect(
      bookingRepository.recordArrival({
        tenantId: fixture.tenantId,
        bookingId: fixture.bookingId,
        actorMembershipId: fixture.membershipId,
        consentId: consent.id,
        customerPhotoMediaId: intent.media.id,
        expectedStateVersion: 1,
        correlationId: 'booking-arrival-ready',
      }),
    ).resolves.toMatchObject({ booking: { status: 'ARRIVED' }, photoDebt: null });
  });

  it('creates walk-in, consent, ARRIVED history, debt and action item atomically', async () => {
    const repository = new BookingRepository(database);
    const occurredAt = new Date('2031-01-15T05:00:00.000Z');
    const result = await repository.createWalkInBooking({
      tenantId: fixture.tenantId,
      branchId: fixture.branchId,
      customerId: fixture.customerId,
      serviceOfferingId: fixture.serviceOfferingId,
      serviceOfferingVersionId: fixture.serviceOfferingVersionId,
      serviceCodeSnapshot: 'US2_SERVICE',
      serviceNameSnapshot: 'US2 service',
      assignedMembershipId: fixture.membershipId,
      occurredAt,
      businessDate: new Date('2031-01-15T00:00:00.000Z'),
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      formTemplateId: fixture.formTemplateId,
      formVersionId: fixture.formVersionId,
      formData: { source: 'walk-in' },
      consentMethod: 'VERBAL',
      consentPolicyVersionId: fixture.consentPolicyVersionId,
      actorMembershipId: fixture.membershipId,
      correlationId: 'walk-in-atomic',
      idempotencyKey: 'walk-in-atomic',
    });
    expect(result).toMatchObject({
      booking: { bookingType: 'WALK_IN', status: 'ARRIVED' },
      photoDebt: { state: 'OPEN' },
    });
    expect(
      await database.bookingStatusTransition.count({
        where: {
          tenantId: fixture.tenantId,
          bookingId: result!.booking.id,
          toStatus: 'ARRIVED',
        },
      }),
    ).toBe(1);
    expect(
      await database.actionItem.count({
        where: {
          tenantId: fixture.tenantId,
          sourceId: result!.photoDebt.id,
          itemType: 'PHOTO_DEBT',
        },
      }),
    ).toBe(1);
  });

  it('binds customer-photo media to the exact consent used by ARRIVED', async () => {
    const repository = new BookingRepository(database);
    const booking = await repository.createScheduledBooking(
      scheduledBookingInput(fixture, {
        scheduledStartAt: new Date('2031-01-15T04:00:00.000Z'),
      }),
    );
    if (!booking) throw new Error('Failed to create consent binding booking');
    const consentA = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'consent-binding-a',
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
      sourceId: booking.id,
      purpose: 'CUSTOMER_BOOKING_PHOTO',
      consentId: consentA.id,
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'e'.repeat(64),
      correlationId: 'consent-binding-intent',
    });
    const stored = await database.mediaObject.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: intent.media.id } },
    });
    expect(stored.consentId).toBe(consentA.id);
    storage.put(intent.media.objectKey, {
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'e'.repeat(64),
    });
    await media.complete(
      fixture.tenantId,
      intent.media.id,
      fixture.membershipId,
      'consent-binding-ready',
    );
    const consentB = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      method: 'WRITTEN',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'consent-binding-b',
    });
    await expect(
      repository.recordArrival({
        tenantId: fixture.tenantId,
        bookingId: booking.id,
        actorMembershipId: fixture.membershipId,
        consentId: consentB.id,
        customerPhotoMediaId: intent.media.id,
        expectedStateVersion: 1,
        correlationId: 'consent-binding-wrong-consent',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    await expect(
      repository.recordArrival({
        tenantId: fixture.tenantId,
        bookingId: booking.id,
        actorMembershipId: fixture.membershipId,
        consentId: consentA.id,
        customerPhotoMediaId: intent.media.id,
        expectedStateVersion: 1,
        correlationId: 'consent-binding-correct-consent',
      }),
    ).resolves.toMatchObject({ booking: { status: 'ARRIVED' }, photoDebt: null });
  });

  it('emits only contract-valid customer-photo-ready events for consent-bound media', async () => {
    const repository = new BookingRepository(database);
    const mediaRepository = new MediaRepository(database);
    const booking = await repository.createScheduledBooking(
      scheduledBookingInput(fixture, {
        scheduledStartAt: new Date('2031-01-15T08:00:00.000Z'),
      }),
    );
    if (!booking) throw new Error('Failed to create event contract booking');
    const consent = await repository.recordCustomerPhotoConsent({
      tenantId: fixture.tenantId,
      bookingId: booking.id,
      actorMembershipId: fixture.membershipId,
      method: 'VERBAL',
      policyVersionId: fixture.consentPolicyVersionId,
      correlationId: 'event-contract-consent',
    });
    const storage = new MemoryObjectStorage();
    const media = new MediaService(mediaRepository, storage, 'booking-test', 300, {
      hasPermission: async () => true,
    } as never);
    const intent = await media.createIntent({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      branchId: fixture.branchId,
      sourceType: 'BOOKING',
      sourceId: booking.id,
      purpose: 'CUSTOMER_BOOKING_PHOTO',
      consentId: consent.id,
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: '6'.repeat(64),
      correlationId: 'event-contract-intent',
    });
    storage.put(intent.media.objectKey, {
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: '6'.repeat(64),
    });
    await media.complete(
      fixture.tenantId,
      intent.media.id,
      fixture.membershipId,
      'event-contract-ready',
    );
    const event = await database.outboxEvent.findUniqueOrThrow({
      where: {
        tenantId_dedupeKey: {
          tenantId: fixture.tenantId,
          dedupeKey: `booking-customer-photo-ready:${intent.media.id}`,
        },
      },
    });
    const payload = event.payloadRedacted as Record<string, unknown>;
    expect(payload).not.toHaveProperty('consentId');
    expect(
      bookingCustomerPhotoReadyEventSchema.parse({
        eventId: event.id,
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        tenantId: event.tenantId,
        branchId: payload.branchId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: event.createdAt.toISOString(),
        correlationId: event.correlationId,
        actorMembershipId: null,
        payload,
      }),
    ).toBeTruthy();

    const unboundMediaId = randomUUID();
    await database.mediaObject.create({
      data: {
        tenantId: fixture.tenantId,
        id: unboundMediaId,
        ownerMembershipId: fixture.membershipId,
        branchId: fixture.branchId,
        sourceType: 'BOOKING',
        sourceId: booking.id,
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        storageProvider: 'memory',
        bucket: 'booking-test',
        objectKey: `${fixture.tenantId}/unbound-${unboundMediaId}`,
        contentType: 'image/jpeg',
        byteSize: 100n,
        checksumSha256: '7'.repeat(64),
        uploadExpiresAt: new Date('2031-01-15T09:00:00.000Z'),
      },
    });
    await mediaRepository.markReady(
      fixture.tenantId,
      unboundMediaId,
      fixture.membershipId,
      'event-contract-unbound-ready',
    );
    await expect(
      database.outboxEvent.findUnique({
        where: {
          tenantId_dedupeKey: {
            tenantId: fixture.tenantId,
            dedupeKey: `booking-customer-photo-ready:${unboundMediaId}`,
          },
        },
      }),
    ).resolves.toBeNull();
  });
});
