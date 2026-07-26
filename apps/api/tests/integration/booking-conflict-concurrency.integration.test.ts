import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

interface Fixture {
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
}

async function createFixture(database: DatabaseClient): Promise<Fixture> {
  const fixture: Fixture = {
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
  };
  await database.$transaction(async (transaction) => {
    await transaction.user.create({
      data: { id: fixture.userId, fullName: 'Booking race actor' },
    });
    await transaction.tenant.create({
      data: {
        id: fixture.tenantId,
        name: 'Booking race tenant',
        slug: `booking-race-${fixture.tenantId}`,
        timezone: 'Asia/Ho_Chi_Minh',
        createdByUserId: fixture.userId,
      },
    });
    await transaction.tenantMembership.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.membershipId,
        userId: fixture.userId,
        membershipDisplayName: 'Booking race actor',
        status: 'ACTIVE',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await transaction.branch.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.branchId,
        code: 'RACE',
        name: 'Race branch',
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
        reason: 'T034 live database fixture',
      },
    });
    await transaction.customer.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.customerId,
        displayName: 'Race customer',
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
        code: 'RACE_SERVICE',
        createdByMembershipId: fixture.membershipId,
      },
    });
    await transaction.serviceOfferingVersion.create({
      data: {
        tenantId: fixture.tenantId,
        id: fixture.serviceOfferingVersionId,
        serviceOfferingId: fixture.serviceOfferingId,
        versionNumber: 1,
        name: 'Race service',
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
        code: 'RACE_BOOKING_FORM',
        name: 'Race booking form',
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
        },
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        publishedByMembershipId: fixture.membershipId,
      },
    });
  });
  return fixture;
}

async function cleanupFixture(database: DatabaseClient, fixture: Fixture) {
  await database.$transaction(async (transaction) => {
    await transaction.outboxEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.auditEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.bookingStatusTransition.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await transaction.booking.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.formSubmission.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.serviceBranchAvailability.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await transaction.serviceOfferingVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await transaction.serviceOffering.deleteMany({ where: { tenantId: fixture.tenantId } });
    await transaction.customerBranchAccess.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
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

live('booking conflict PostgreSQL race', () => {
  let database: DatabaseClient;
  let fixture: Fixture;

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createFixture(database);
  });

  afterAll(async () => {
    await cleanupFixture(database, fixture);
    await database.$disconnect();
  });

  it('commits at most one of two concurrent conflicting scheduled bookings', async () => {
    const contenderA = createDatabaseClient(databaseUrl!);
    const contenderB = createDatabaseClient(databaseUrl!);
    const repositoryA = new BookingRepository(contenderA);
    const repositoryB = new BookingRepository(contenderB);
    const scheduledStartAt = new Date('2030-01-15T02:00:00.000Z');
    const base = {
      tenantId: fixture.tenantId,
      branchId: fixture.branchId,
      customerId: fixture.customerId,
      serviceOfferingId: fixture.serviceOfferingId,
      serviceOfferingVersionId: fixture.serviceOfferingVersionId,
      serviceCodeSnapshot: 'RACE_SERVICE',
      serviceNameSnapshot: 'Race service',
      assignedMembershipId: fixture.membershipId,
      scheduledStartAt,
      businessDate: new Date('2030-01-15T00:00:00.000Z'),
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      formTemplateId: fixture.formTemplateId,
      formVersionId: fixture.formVersionId,
      formData: { source: 'T034' },
      actorMembershipId: fixture.membershipId,
    };
    const results = await Promise.allSettled([
      repositoryA.createScheduledBooking({
        ...base,
        correlationId: 'booking-live-race-a',
        idempotencyKey: 'booking-live-race-key-a',
      }),
      repositoryB.createScheduledBooking({
        ...base,
        correlationId: 'booking-live-race-b',
        idempotencyKey: 'booking-live-race-key-b',
      }),
    ]);
    await Promise.all([contenderA.$disconnect(), contenderB.$disconnect()]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      cause: { code: '23P01' },
    });
    expect(
      String(
        (
          (rejected as PromiseRejectedResult).reason as {
            cause?: { message?: string };
          }
        ).cause?.message,
      ),
    ).toContain('booking_active_employee_60m_excl');
    expect(
      await database.booking.count({
        where: {
          tenantId: fixture.tenantId,
          branchId: fixture.branchId,
          assignedMembershipId: fixture.membershipId,
          scheduledStartAt,
        },
      }),
    ).toBe(1);
    expect(
      await database.formSubmission.count({
        where: {
          tenantId: fixture.tenantId,
          idempotencyKey: {
            in: ['booking:booking-live-race-key-a', 'booking:booking-live-race-key-b'],
          },
        },
      }),
    ).toBe(1);
    expect(
      await database.bookingStatusTransition.count({
        where: { tenantId: fixture.tenantId },
      }),
    ).toBe(1);
    expect(
      await database.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'booking.scheduled.v1' },
      }),
    ).toBe(1);
  });
});
