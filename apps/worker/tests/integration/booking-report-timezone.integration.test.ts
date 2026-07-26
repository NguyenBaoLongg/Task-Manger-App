import { describe, expect, it, vi } from 'vitest';
import { afterAll, beforeAll } from 'vitest';
import {
  BookingWorkerRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { getBookingReportWindow } from '@adsup/domain';
import { BookingReportService } from '../../../api/src/modules/bookings/booking-report-service.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

describe('booking report timezone rerun audit', () => {
  it('persists the requested tenant-local business date and audit reason', async () => {
    const enqueueRerun = vi.fn().mockResolvedValue({ id: 'run-1', state: 'PENDING' });
    const service = new BookingReportService(
      { enqueueReportRerun: enqueueRerun } as never,
      {
        resolvePermissionScope: vi.fn().mockResolvedValue({ tenantWide: true, branchIds: [] }),
      } as never,
    );
    await expect(
      service.rerun({
        tenantId: 'tenant-1',
        actorMembershipId: 'member-1',
        correlationId: 'rerun-1',
        reportType: 'TODAY_OUTCOME',
        businessDate: '2031-01-15',
        reason: 'Retry failed delivery',
      }),
    ).resolves.toMatchObject({ id: 'run-1' });
    expect(enqueueRerun).toHaveBeenCalledWith(
      expect.objectContaining({
        businessDate: new Date('2031-01-15T00:00:00.000Z'),
        reason: 'Retry failed delivery',
      }),
    );
  });

  it('changes the business date when the tenant timezone changes', () => {
    const now = new Date('2031-01-15T01:00:00.000Z');
    expect(getBookingReportWindow('TODAY_OUTCOME', now, 'Asia/Ho_Chi_Minh').businessDate).toBe(
      '2031-01-15',
    );
    expect(getBookingReportWindow('TODAY_OUTCOME', now, 'America/New_York').businessDate).toBe(
      '2031-01-14',
    );
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking report rerun audit', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });
  afterAll(async () => {
    await database.bookingJobRun.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.auditEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('writes a tenant-scoped audit record for an explicit rerun', async () => {
    const run = await new BookingWorkerRepository(database).enqueueReportRerun({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      correlationId: 'us4-rerun-live',
      reportType: 'TODAY_OUTCOME',
      businessDate: new Date('2031-01-15T00:00:00.000Z'),
      branchIds: [fixture.branchId],
      reason: 'Retry failed destination',
    });
    expect(run.state).toBe('PENDING');
    expect(
      await database.auditEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'BOOKING_REPORT_RERUN_REQUESTED' },
      }),
    ).toBe(1);
  });
});
