import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { BookingConfigService } from '../../src/modules/bookings/booking-config-service.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

describe('booking retention policy configuration', () => {
  it('requires tenant-owner scope and preserves versioned configuration history', async () => {
    const repository = {
      createServiceOfferingVersion: vi.fn().mockResolvedValue({ versionNumber: 2 }),
      createCustomerPhotoConsentPolicyVersion: vi.fn().mockResolvedValue({ versionNumber: 2 }),
      createBookingRetentionPolicyVersion: vi.fn().mockResolvedValue({ versionNumber: 2 }),
      getEffectiveBookingRetentionPolicy: vi.fn().mockResolvedValue({ versionNumber: 2 }),
      changeMediaLegalHold: vi.fn(),
    };
    const authorization = {
      resolvePermissionScope: vi.fn().mockResolvedValue({ tenantWide: true, branchIds: [] }),
    };
    const service = new BookingConfigService(repository as never, authorization as never);
    await expect(
      service.createBookingRetentionPolicyVersion({
        tenantId: 'tenant-1',
        actorMembershipId: 'owner-1',
        correlationId: 'retention-config-1',
        customerPhotoDays: 180,
        xlsxDays: 30,
        effectiveFrom: new Date('2026-07-25T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ versionNumber: 2 });
    await expect(
      service.getEffectiveBookingRetentionPolicy({
        tenantId: 'tenant-1',
        actorMembershipId: 'owner-1',
        effectiveAt: new Date('2026-07-25T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ versionNumber: 2 });
    expect(authorization.resolvePermissionScope).toHaveBeenCalledWith(
      'tenant-1',
      'owner-1',
      'booking.retention.manage',
    );
  });

  it('rejects a branch-scoped actor from changing tenant policy', async () => {
    const service = new BookingConfigService(
      {} as never,
      {
        resolvePermissionScope: vi
          .fn()
          .mockResolvedValue({ tenantWide: false, branchIds: ['branch-1'] }),
      } as never,
    );
    await expect(
      service.createBookingRetentionPolicyVersion({
        tenantId: 'tenant-1',
        actorMembershipId: 'manager-1',
        correlationId: 'retention-config-2',
        customerPhotoDays: 180,
        xlsxDays: 30,
        effectiveFrom: new Date('2026-07-25T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking retention policy PostgreSQL history', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });

  afterAll(async () => {
    await database.bookingRetentionPolicyVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await database.customerPhotoConsentPolicyVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('keeps policy versions immutable and selects the correct effective interval', async () => {
    const repository = new BookingRepository(database);
    const first = await repository.createBookingRetentionPolicyVersion({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      correlationId: 'live-retention-policy-v1',
      customerPhotoDays: 180,
      xlsxDays: 30,
      effectiveFrom: new Date('2031-01-01T00:00:00.000Z'),
    });
    const second = await repository.createBookingRetentionPolicyVersion({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      correlationId: 'live-retention-policy-v2',
      customerPhotoDays: 90,
      xlsxDays: 15,
      effectiveFrom: new Date('2031-07-01T00:00:00.000Z'),
    });
    expect(second.versionNumber).toBe(first.versionNumber + 1);
    expect(
      (
        await repository.getEffectiveBookingRetentionPolicy({
          tenantId: fixture.tenantId,
          effectiveAt: new Date('2031-03-01T00:00:00.000Z'),
        })
      )?.id,
    ).toBe(first.id);
    expect(
      (
        await repository.getEffectiveBookingRetentionPolicy({
          tenantId: fixture.tenantId,
          effectiveAt: new Date('2031-08-01T00:00:00.000Z'),
        })
      )?.id,
    ).toBe(second.id);
    expect(
      (
        await database.bookingRetentionPolicyVersion.findUnique({
          where: { tenantId_id: { tenantId: fixture.tenantId, id: first.id } },
        })
      )?.effectiveTo,
    ).toEqual(second.effectiveFrom);
    expect(
      await database.auditEvent.count({
        where: {
          tenantId: fixture.tenantId,
          eventType: 'BOOKING_RETENTION_POLICY_VERSION_CREATED',
        },
      }),
    ).toBe(2);
  });
});
