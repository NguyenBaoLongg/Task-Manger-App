import { randomUUID } from 'node:crypto';
import {
  BookingRepository,
  type DatabaseClient,
  type ScheduledBookingWrite,
} from '@adsup/database';

export interface BookingLiveFixture {
  userId: string;
  tenantId: string;
  membershipId: string;
  branchId: string;
  assignmentId: string;
  customerId: string;
  serviceOfferingId: string;
  serviceOfferingVersionId: string;
  serviceAvailabilityId: string;
  formTemplateId: string;
  formVersionId: string;
  consentPolicyVersionId: string;
  bookingId: string;
}

export async function createBookingLiveFixture(
  database: DatabaseClient,
): Promise<BookingLiveFixture> {
  const fixture = {
    userId: randomUUID(),
    tenantId: randomUUID(),
    membershipId: randomUUID(),
    branchId: randomUUID(),
    assignmentId: randomUUID(),
    customerId: randomUUID(),
    serviceOfferingId: randomUUID(),
    serviceOfferingVersionId: randomUUID(),
    serviceAvailabilityId: randomUUID(),
    formTemplateId: randomUUID(),
    formVersionId: randomUUID(),
    consentPolicyVersionId: randomUUID(),
    bookingId: '',
  };
  await database.$transaction(async (transaction) => {
    await transaction.user.create({
      data: { id: fixture.userId, fullName: 'Booking US2 actor' },
    });
    await transaction.tenant.create({
      data: {
        id: fixture.tenantId,
        name: 'Booking US2 tenant',
        slug: `booking-us2-${fixture.tenantId}`,
        timezone: 'Asia/Ho_Chi_Minh',
        createdByUserId: fixture.userId,
      },
    });
    await transaction.tenantMembership.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.membershipId,
        userId: fixture.userId,
        membershipDisplayName: 'Booking US2 actor',
        status: 'ACTIVE',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await transaction.branch.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.branchId,
        code: 'US2',
        name: 'US2 branch',
        createdByMembershipId: fixture.membershipId,
      },
    });
    await transaction.assignment.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.assignmentId,
        membershipId: fixture.membershipId,
        branchId: fixture.branchId,
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdByMembershipId: fixture.membershipId,
        reason: 'Module 4 US2 live fixture',
      },
    });
    await transaction.customer.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.customerId,
        displayName: 'US2 customer',
        createdByMembershipId: fixture.membershipId,
      },
    });
    await transaction.customerBranchAccess.create({
      data: {
        tenantId: fixture.tenantId,
        customerId: fixture.customerId,
        branchId: fixture.branchId,
        grantedByMembershipId: fixture.membershipId,
      },
    });
    await transaction.serviceOffering.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.serviceOfferingId,
        code: 'US2_SERVICE',
        createdByMembershipId: fixture.membershipId,
      },
    });
    await transaction.serviceOfferingVersion.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.serviceOfferingVersionId,
        serviceOfferingId: fixture.serviceOfferingId,
        versionNumber: 1,
        name: 'US2 service',
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdByMembershipId: fixture.membershipId,
      },
    });
    await transaction.serviceBranchAvailability.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.serviceAvailabilityId,
        serviceOfferingId: fixture.serviceOfferingId,
        serviceOfferingVersionId: fixture.serviceOfferingVersionId,
        branchId: fixture.branchId,
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await transaction.formTemplate.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.formTemplateId,
        code: 'US2_BOOKING_FORM',
        name: 'US2 booking form',
        status: 'ACTIVE',
        createdByMembershipId: fixture.membershipId,
      },
    });
    await transaction.formVersion.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.formVersionId,
        formTemplateId: fixture.formTemplateId,
        versionNumber: 1,
        status: 'PUBLISHED',
        jsonSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          additionalProperties: true,
        },
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        publishedByMembershipId: fixture.membershipId,
      },
    });
    await transaction.customerPhotoConsentPolicyVersion.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.consentPolicyVersionId,
        versionNumber: 1,
        title: 'Customer photo consent',
        policyText: 'Customer agrees to a booking photo.',
        allowedMethods: ['VERBAL', 'WRITTEN'],
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdByMembershipId: fixture.membershipId,
      },
    });
  });
  const booking = await new BookingRepository(database).createScheduledBooking(
    scheduledBookingInput(fixture),
  );
  if (!booking) throw new Error('Failed to create booking US2 fixture');
  fixture.bookingId = booking.id;
  return fixture;
}

export function scheduledBookingInput(
  fixture: Omit<BookingLiveFixture, 'bookingId'> | BookingLiveFixture,
  overrides: Partial<ScheduledBookingWrite> = {},
): ScheduledBookingWrite {
  return {
    tenantId: fixture.tenantId,
    branchId: fixture.branchId,
    customerId: fixture.customerId,
    serviceOfferingId: fixture.serviceOfferingId,
    serviceOfferingVersionId: fixture.serviceOfferingVersionId,
    serviceCodeSnapshot: 'US2_SERVICE',
    serviceNameSnapshot: 'US2 service',
    assignedMembershipId: fixture.membershipId,
    scheduledStartAt: new Date('2031-01-15T02:00:00.000Z'),
    businessDate: new Date('2031-01-15T00:00:00.000Z'),
    timezoneSnapshot: 'Asia/Ho_Chi_Minh',
    formTemplateId: fixture.formTemplateId,
    formVersionId: fixture.formVersionId,
    formData: { source: 'US2' },
    actorMembershipId: fixture.membershipId,
    correlationId: `booking-us2-${randomUUID()}`,
    idempotencyKey: `booking-us2-${randomUUID()}`,
    ...overrides,
  };
}

export async function cleanupBookingLiveFixture(
  database: DatabaseClient,
  fixture: BookingLiveFixture,
) {
  await database.$transaction(async (transaction) => {
    await transaction.outboxEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.auditEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.actionItemTransition.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.actionItem.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.tourCompletion.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.customerPhotoDebt.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.customerPhotoConsent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.mediaObject.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.bookingStatusTransition.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.booking.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.formSubmission.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.customerPhotoConsentPolicyVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await transaction.serviceBranchAvailability.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await transaction.serviceOfferingVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await transaction.serviceOffering.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.customerBranchAccess.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.customer.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.formVersion.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.formTemplate.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.assignment.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.branch.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.tenantMembership.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.tenant.deleteMany({ where: { id: fixture.tenantId } });
    await transaction.user.deleteMany({ where: { id: fixture.userId } });
  });
}
