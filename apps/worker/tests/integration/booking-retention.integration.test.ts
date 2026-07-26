import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BookingWorkerRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { BookingRetentionRunner } from '../../src/bookings/retention-runner.ts';
import { BookingRetentionSchedulerRunner } from '../../src/bookings/scheduler.ts';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

describe('booking/export media retention', () => {
  it('deletes eligible customer photos and XLSX, preserves holds, and dedupes retries', async () => {
    const candidates = [
      {
        tenantId: 'tenant-1',
        id: 'photo-1',
        objectKey: 'tenant-1/photo-1',
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        legalHoldAt: null,
      },
      {
        tenantId: 'tenant-1',
        id: 'export-1',
        objectKey: 'tenant-1/export-1',
        purpose: 'REPORT_XLSX',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        legalHoldAt: null,
      },
      {
        tenantId: 'tenant-1',
        id: 'held-1',
        objectKey: 'tenant-1/held-1',
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        legalHoldAt: new Date('2026-07-25T00:00:00.000Z'),
      },
    ];
    const deleted: string[] = [];
    const getRetentionPolicyAt = vi.fn(async () => ({ id: 'policy-v1' }));
    const tombstone = vi.fn(async (input: { mediaObjectId: string }) => {
      const item = candidates.find((candidate) => candidate.id === input.mediaObjectId);
      if (item) (item as { deleted?: boolean }).deleted = true;
    });
    const runner = new BookingRetentionRunner(
      {
        listBookingRetentionCandidates: vi.fn(async () =>
          candidates.filter((item) => !('deleted' in item)),
        ),
        getRetentionPolicyAt,
        tombstoneMediaObject: tombstone,
      } as never,
      {
        delete: vi.fn(async (input: { objectKey: string }) => deleted.push(input.objectKey)),
      },
    );
    await expect(
      runner.runTenant({ tenantId: 'tenant-1', now: new Date('2026-08-01T00:00:00.000Z') }),
    ).resolves.toMatchObject({
      deleted: 2,
      skippedLegalHold: 1,
    });
    await expect(runner.runTenant({ tenantId: 'tenant-1' })).resolves.toMatchObject({ deleted: 0 });
    expect(deleted).toEqual(['tenant-1/photo-1', 'tenant-1/export-1']);
    expect(tombstone).toHaveBeenCalledTimes(2);
    expect(getRetentionPolicyAt).toHaveBeenCalledTimes(2);
    expect(tombstone).toHaveBeenLastCalledWith(
      expect.objectContaining({ policyVersionId: 'policy-v1' }),
    );
  });

  it('returns retention job to retryable state when one media deletion fails', async () => {
    const failRetentionRun = vi.fn(async () => undefined);
    const completeRetentionRun = vi.fn(async () => undefined);
    const runner = new BookingRetentionSchedulerRunner(
      {
        listTenantIds: vi.fn(async () => ['tenant-1']),
        ensureRetentionRun: vi.fn(async () => ({ id: 'run-1' })),
        claimRetentionRun: vi.fn(async () => ({ id: 'run-1' })),
        heartbeatReportRun: vi.fn(async () => undefined),
        completeRetentionRun,
        failRetentionRun,
      },
      {
        runTenant: vi.fn(async () => ({
          processed: 1,
          deleted: 0,
          skippedLegalHold: 0,
          failed: 1,
        })),
      } as never,
      'worker-1',
    );

    await expect(runner.run(new Date('2026-07-25T00:00:00.000Z'))).resolves.toEqual([
      { jobType: 'BOOKING_MEDIA_RETENTION', processed: 1 },
    ]);
    expect(failRetentionRun).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BOOKING_MEDIA_RETENTION_PARTIAL_FAILURE' }),
    );
    expect(completeRetentionRun).not.toHaveBeenCalled();
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking/export media retention PostgreSQL lifecycle', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  const mediaIds: string[] = [];

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
    await database.bookingRetentionPolicyVersion.create({
      data: {
        tenantId: fixture.tenantId,
        versionNumber: 1,
        customerPhotoDays: 180,
        xlsxDays: 30,
        platformBoundsJson: { customerPhotoDaysMax: 3650, xlsxDaysMax: 365 },
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        createdByMembershipId: fixture.membershipId,
      },
    });
    for (const [purpose, held] of [
      ['CUSTOMER_BOOKING_PHOTO', false],
      ['REPORT_XLSX', false],
      ['CUSTOMER_BOOKING_PHOTO', true],
    ] as const) {
      const media = await database.mediaObject.create({
        data: {
          tenantId: fixture.tenantId,
          ownerMembershipId: fixture.membershipId,
          branchId: fixture.branchId,
          sourceType: purpose === 'REPORT_XLSX' ? 'EXPORT' : 'BOOKING',
          sourceId: purpose === 'REPORT_XLSX' ? null : fixture.bookingId,
          purpose,
          storageProvider: 'test',
          bucket: 'retention-test',
          objectKey: `${fixture.tenantId}/${purpose}/${mediaIds.length}`,
          contentType:
            purpose === 'REPORT_XLSX'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'image/jpeg',
          byteSize: 1,
          checksumSha256: `${mediaIds.length + 1}`.padStart(64, '0'),
          status: 'READY',
          uploadExpiresAt: new Date('2031-01-01T00:00:00.000Z'),
          readyAt: new Date('2031-01-01T00:00:00.000Z'),
          retentionUntil: new Date('2031-01-02T00:00:00.000Z'),
          legalHoldAt: held ? new Date('2031-01-01T00:00:00.000Z') : null,
        },
      });
      mediaIds.push(media.id);
    }
  });

  afterAll(async () => {
    await database.mediaRetentionTombstone.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.mediaObject.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.bookingRetentionPolicyVersion.deleteMany({
      where: { tenantId: fixture.tenantId },
    });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('deletes only eligible media, preserves tombstones and is idempotent on repeat', async () => {
    const deletedKeys: string[] = [];
    const repository = new BookingWorkerRepository(database);
    const policy = await repository.getRetentionPolicyAt({
      tenantId: fixture.tenantId,
      at: new Date('2026-07-25T00:00:00.000Z'),
    });
    expect(policy?.id).toEqual(expect.any(String));
    const runner = new BookingRetentionRunner(repository, {
      async delete(input) {
        deletedKeys.push(input.objectKey);
      },
    });
    await expect(
      runner.runTenant({ tenantId: fixture.tenantId, now: new Date('2031-01-03T00:00:00.000Z') }),
    ).resolves.toMatchObject({ processed: 3, deleted: 2, skippedLegalHold: 1, failed: 0 });
    expect(
      await database.mediaRetentionTombstone.count({ where: { tenantId: fixture.tenantId } }),
    ).toBe(2);
    expect(
      await database.mediaRetentionTombstone.count({
        where: { tenantId: fixture.tenantId, policyVersionId: { not: null } },
      }),
    ).toBe(2);
    expect(
      await database.mediaObject.count({
        where: { tenantId: fixture.tenantId, status: 'DELETED' },
      }),
    ).toBe(2);
    await expect(
      runner.runTenant({ tenantId: fixture.tenantId, now: new Date('2031-01-04T00:00:00.000Z') }),
    ).resolves.toMatchObject({ processed: 1, deleted: 0, skippedLegalHold: 1 });
    expect(deletedKeys).toHaveLength(2);
  });
});
