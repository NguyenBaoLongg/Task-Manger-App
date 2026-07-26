import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BookingWorkerRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { BookingReportRunner } from '../../src/bookings/report-runner.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

describe('booking report lease and delivery dedupe', () => {
  it('allows one worker claim and retries failed delivery without duplicate success', async () => {
    const repository = {
      listTenantIds: vi.fn().mockResolvedValue(['tenant-1']),
      getTenantTimezone: vi.fn().mockResolvedValue('Asia/Ho_Chi_Minh'),
      listActiveBranchIds: vi.fn().mockResolvedValue(['branch-1']),
      listBookingReportDestinations: vi
        .fn()
        .mockResolvedValue([
          { id: 'dest-1', branchId: null, reportType: 'TODAY_OUTCOME', chatChannelId: 'channel-1' },
        ]),
      ensureReportRun: vi.fn().mockResolvedValue({ id: 'run-1', branchScopeJson: [] }),
      claimReportRun: vi.fn().mockResolvedValue({ id: 'run-1', attempt: 1 }),
      listBookingReportRows: vi.fn().mockResolvedValue([]),
      upsertReportDelivery: vi
        .fn()
        .mockResolvedValue({ id: 'delivery-1', dedupeKey: 'dedupe-1', state: 'PENDING' }),
      markReportDeliverySent: vi.fn(),
      markReportDeliveryFailed: vi.fn(),
      completeReportRun: vi.fn(),
      failReportRun: vi.fn(),
    };
    const delivery = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValue({ messageId: 'message-1' }),
    };
    const runner = new BookingReportRunner(repository as never, delivery as never);
    await expect(
      runner.run({
        tenantId: 'tenant-1',
        reportType: 'TODAY_OUTCOME',
        now: new Date('2031-01-15T15:00:00Z'),
      }),
    ).rejects.toThrow('temporary');
    await expect(
      runner.run({
        tenantId: 'tenant-1',
        reportType: 'TODAY_OUTCOME',
        now: new Date('2031-01-15T15:00:00Z'),
      }),
    ).resolves.toMatchObject({ claimed: true, processed: 1 });
    expect(repository.claimReportRun).toHaveBeenCalledTimes(2);
    expect(repository.markReportDeliverySent).toHaveBeenCalledOnce();
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking report PostgreSQL lease concurrency', () => {
  let databaseA: DatabaseClient;
  let databaseB: DatabaseClient;
  let fixture: BookingLiveFixture;
  afterAll(async () => {
    await databaseA.bookingReportDelivery.deleteMany({ where: { tenantId: fixture.tenantId } });
    await databaseA.bookingJobRun.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(databaseA, fixture);
    await databaseA.$disconnect();
    await databaseB.$disconnect();
  });
  beforeAll(async () => {
    databaseA = createDatabaseClient(databaseUrl!);
    databaseB = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(databaseA);
  });

  it('commits only one owner for two concurrent report claims', async () => {
    const ownerA = new BookingWorkerRepository(databaseA);
    const ownerB = new BookingWorkerRepository(databaseB);
    const run = await ownerA.ensureReportRun({
      tenantId: fixture.tenantId,
      reportType: 'TODAY_OUTCOME',
      businessDate: new Date('2031-01-15T00:00:00.000Z'),
      branchIds: [fixture.branchId],
      correlationId: 'us4-lease-live',
    });
    const [claimA, claimB] = await Promise.all([
      ownerA.claimReportRun({
        tenantId: fixture.tenantId,
        runId: run.id,
        leaseOwner: 'worker-a',
        now: new Date('2031-01-15T15:00:00Z'),
        leaseDurationMs: 60_000,
      }),
      ownerB.claimReportRun({
        tenantId: fixture.tenantId,
        runId: run.id,
        leaseOwner: 'worker-b',
        now: new Date('2031-01-15T15:00:00Z'),
        leaseDurationMs: 60_000,
      }),
    ]);
    expect([claimA, claimB].filter(Boolean)).toHaveLength(1);
    const claimedOwner = claimA ? ownerA : ownerB;
    const claimed = claimA ?? claimB;
    const before = await databaseA.bookingJobRun.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: run.id } },
    });
    await claimedOwner.heartbeatReportRun({
      tenantId: fixture.tenantId,
      runId: run.id,
      leaseOwner: claimed?.leaseOwner ?? '',
      now: new Date('2031-01-15T15:00:30Z'),
      leaseDurationMs: 60_000,
    });
    const after = await databaseA.bookingJobRun.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: run.id } },
    });
    expect(after.leaseUntil?.getTime()).toBeGreaterThan(before.leaseUntil?.getTime() ?? 0);
  });

  it('does not resend a successful destination when a second destination retries', async () => {
    const deliveryStates = new Map([
      ['channel-a', 'PENDING'],
      ['channel-b', 'PENDING'],
    ]);
    const repository = {
      listTenantIds: vi.fn(),
      getTenantTimezone: vi.fn().mockResolvedValue('Asia/Ho_Chi_Minh'),
      listActiveBranchIds: vi.fn().mockResolvedValue(['branch-1']),
      listBookingReportDestinations: vi.fn().mockResolvedValue([
        { id: 'dest-a', branchId: null, reportType: 'TODAY_OUTCOME', chatChannelId: 'channel-a' },
        { id: 'dest-b', branchId: null, reportType: 'TODAY_OUTCOME', chatChannelId: 'channel-b' },
      ]),
      ensureReportRun: vi.fn().mockResolvedValue({ id: 'run-partial', branchScopeJson: [] }),
      claimReportRun: vi.fn().mockResolvedValue({ id: 'run-partial', attempt: 1 }),
      listBookingReportRows: vi.fn().mockResolvedValue([]),
      upsertReportDelivery: vi
        .fn()
        .mockImplementation(({ destinationChannelId }: { destinationChannelId: string }) =>
          Promise.resolve({
            id: `delivery-${destinationChannelId}`,
            dedupeKey: `dedupe-${destinationChannelId}`,
            state: deliveryStates.get(destinationChannelId),
          }),
        ),
      markReportDeliverySent: vi
        .fn()
        .mockImplementation(({ deliveryId }: { deliveryId: string }) => {
          deliveryStates.set(deliveryId.replace('delivery-', ''), 'SUCCEEDED');
        }),
      markReportDeliveryFailed: vi.fn(),
      completeReportRun: vi.fn(),
      failReportRun: vi.fn(),
    };
    const delivery = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ messageId: 'message-a' })
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValueOnce({ messageId: 'message-b' }),
    };
    const runner = new BookingReportRunner(repository as never, delivery as never);
    await expect(
      runner.run({
        tenantId: 'tenant-1',
        reportType: 'TODAY_OUTCOME',
        now: new Date('2031-01-15T15:00:00Z'),
      }),
    ).rejects.toThrow('temporary');
    await expect(
      runner.run({
        tenantId: 'tenant-1',
        reportType: 'TODAY_OUTCOME',
        now: new Date('2031-01-15T15:00:00Z'),
      }),
    ).resolves.toMatchObject({ claimed: true, processed: 1 });
    expect(delivery.send).toHaveBeenCalledTimes(3);
    expect(
      delivery.send.mock.calls.filter(([input]) => input.channelId === 'channel-a'),
    ).toHaveLength(1);
    expect(
      delivery.send.mock.calls.filter(([input]) => input.channelId === 'channel-b'),
    ).toHaveLength(2);
    expect(delivery.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ channelId: 'channel-b' }),
    );
  });
});
