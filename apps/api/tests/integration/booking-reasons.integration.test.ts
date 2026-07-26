import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking cancellation reason versions', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  let reasonId: string;
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

  it('records an immutable reason snapshot when a reason is later disabled', async () => {
    const repository = new BookingRepository(database);
    const first = await repository.createCancellationReasonVersion({
      tenantId: fixture.tenantId,
      code: 'CUSTOMER_REQUEST',
      label: 'Customer request',
      appliesToCancellation: true,
      appliesToReschedule: true,
      status: 'ACTIVE',
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-reason-create',
    });
    reasonId = first.reasonId;
    const outcome = await repository.recordBookingOutcome({
      tenantId: fixture.tenantId,
      bookingId: fixture.bookingId,
      actorMembershipId: fixture.membershipId,
      outcome: 'CANCELLED',
      reasonVersionId: first.id,
      expectedStateVersion: 1,
      correlationId: 'us3-outcome',
    });
    expect(outcome.status).toBe('CANCELLED');
    await repository.createCancellationReasonVersion({
      tenantId: fixture.tenantId,
      reasonId,
      code: 'CUSTOMER_REQUEST',
      label: 'Disabled customer request',
      appliesToCancellation: true,
      appliesToReschedule: true,
      status: 'INACTIVE',
      effectiveFrom: new Date('2031-02-01T00:00:00.000Z'),
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-reason-disable',
    });
    const transition = await database.bookingStatusTransition.findFirstOrThrow({
      where: { tenantId: fixture.tenantId, bookingId: fixture.bookingId, toStatus: 'CANCELLED' },
    });
    expect(transition.reasonCodeSnapshot).toBe('CUSTOMER_REQUEST');
    expect(transition.reasonLabelSnapshot).toBe('Customer request');
  });

  it('closes the previous effective range and rejects the superseded version', async () => {
    const repository = new BookingRepository(database);
    const active = await repository.createCancellationReasonVersion({
      tenantId: fixture.tenantId,
      code: 'DISABLE_AFTER_USE',
      label: 'Disable after use',
      appliesToCancellation: true,
      appliesToReschedule: true,
      status: 'ACTIVE',
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-effective-range-create',
    });
    const booking = await repository.createScheduledBooking({
      tenantId: fixture.tenantId,
      branchId: fixture.branchId,
      customerId: fixture.customerId,
      serviceOfferingId: fixture.serviceOfferingId,
      serviceOfferingVersionId: fixture.serviceOfferingVersionId,
      serviceCodeSnapshot: 'US2_SERVICE',
      serviceNameSnapshot: 'US2 service',
      assignedMembershipId: fixture.membershipId,
      scheduledStartAt: new Date('2031-03-01T02:00:00.000Z'),
      businessDate: new Date('2031-03-01T00:00:00.000Z'),
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      formTemplateId: fixture.formTemplateId,
      formVersionId: fixture.formVersionId,
      formData: { source: 'T147' },
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-effective-range-booking',
      idempotencyKey: 'us3-effective-range-booking',
    });
    expect(booking).toBeTruthy();
    const inactive = await repository.createCancellationReasonVersion({
      tenantId: fixture.tenantId,
      reasonId: active.reasonId,
      code: 'DISABLE_AFTER_USE',
      label: 'Disabled after use',
      appliesToCancellation: true,
      appliesToReschedule: true,
      status: 'INACTIVE',
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorMembershipId: fixture.membershipId,
      correlationId: 'us3-effective-range-disable',
    });
    expect(inactive.effectiveTo).toBeNull();
    const previous = await database.bookingCancellationReasonVersion.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: active.id } },
    });
    expect(previous.effectiveTo).toEqual(inactive.effectiveFrom);
    expect(
      await repository.listCancellationReasonVersions({
        tenantId: fixture.tenantId,
        effectiveAt: new Date('2026-07-25T00:00:00.000Z'),
      }),
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ reasonId: active.reasonId })]));
    await expect(
      repository.recordBookingOutcome({
        tenantId: fixture.tenantId,
        bookingId: booking!.id,
        actorMembershipId: fixture.membershipId,
        outcome: 'CANCELLED',
        reasonVersionId: active.id,
        expectedStateVersion: 1,
        correlationId: 'us3-effective-range-reject',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    expect(
      await database.booking.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: fixture.tenantId, id: booking!.id } },
      }),
    ).toMatchObject({ status: 'SCHEDULED', stateVersion: 1 });
  });
});
