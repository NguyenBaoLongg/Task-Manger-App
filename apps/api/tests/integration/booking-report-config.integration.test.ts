import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BookingRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { BookingReportService } from '../../src/modules/bookings/booking-report-service.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

describe('booking report destination configuration', () => {
  it('rejects a branch destination outside the actor scope and delegates valid tenant scope', async () => {
    const repository = {
      listBookingReportDestinations: vi.fn().mockResolvedValue([]),
      replaceBookingReportDestinations: vi.fn().mockResolvedValue([{ id: 'destination-1' }]),
    };
    const authorization = {
      resolvePermissionScope: vi
        .fn()
        .mockResolvedValue({ tenantWide: false, branchIds: ['branch-a'] }),
    };
    const service = new BookingReportService(repository as never, authorization as never);
    await expect(
      service.replaceDestinations({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'report-config-1',
        items: [{ branchId: 'branch-b', reportType: 'TODAY_OUTCOME', chatChannelId: 'channel-b' }],
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
    await expect(
      service.replaceDestinations({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'report-config-2',
        items: [{ branchId: 'branch-a', reportType: 'TODAY_OUTCOME', chatChannelId: 'channel-a' }],
      }),
    ).resolves.toEqual([{ id: 'destination-1' }]);
  });

  it('does not let a branch-scoped actor manage a tenant-wide destination', async () => {
    const service = new BookingReportService(
      { replaceBookingReportDestinations: vi.fn() } as never,
      {
        resolvePermissionScope: vi
          .fn()
          .mockResolvedValue({ tenantWide: false, branchIds: ['branch-a'] }),
      } as never,
    );
    await expect(
      service.replaceDestinations({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'report-config-tenant-wide',
        items: [{ reportType: 'TODAY_OUTCOME', chatChannelId: 'tenant-channel' }],
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking report destination PostgreSQL validation', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  let otherFixture: BookingLiveFixture;
  let channelId: string;
  let otherChannelId: string;
  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
    otherFixture = await createBookingLiveFixture(database);
    const channel = await database.chatChannel.create({
      data: {
        tenantId: fixture.tenantId,
        type: 'BRANCH',
        name: 'US4 report channel',
        branchId: fixture.branchId,
        createdByMembershipId: fixture.membershipId,
      },
    });
    channelId = channel.id;
    const otherChannel = await database.chatChannel.create({
      data: {
        tenantId: otherFixture.tenantId,
        type: 'BRANCH',
        name: 'Other tenant report channel',
        branchId: otherFixture.branchId,
        createdByMembershipId: otherFixture.membershipId,
      },
    });
    otherChannelId = otherChannel.id;
  });
  afterAll(async () => {
    await database.bookingReportDestination.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.chatChannel.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.chatChannel.deleteMany({ where: { tenantId: otherFixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await cleanupBookingLiveFixture(database, otherFixture);
    await database.$disconnect();
  });

  it('stores only same-tenant branch-compatible destinations and preserves audit history', async () => {
    const repository = new BookingRepository(database);
    const rows = await repository.replaceBookingReportDestinations({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      correlationId: 'us4-destination-live',
      items: [
        { branchId: fixture.branchId, reportType: 'TODAY_OUTCOME', chatChannelId: channelId },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.branchId).toBe(fixture.branchId);
    expect(
      await database.auditEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'BOOKING_REPORT_DESTINATION_REPLACED' },
      }),
    ).toBe(1);
  });

  it('rejects a chat channel owned by another tenant', async () => {
    const repository = new BookingRepository(database);
    await expect(
      repository.replaceBookingReportDestinations({
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.membershipId,
        correlationId: 'us4-cross-tenant-channel',
        items: [
          {
            branchId: fixture.branchId,
            reportType: 'TODAY_OUTCOME',
            chatChannelId: otherChannelId,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});
