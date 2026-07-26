import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExportRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { ExportRunner } from '../../src/exports/export-runner.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

describe('booking export keyset checkpointing', () => {
  it('uses a stable cursor and records progress between bounded pages', async () => {
    const repository = {
      claimExport: vi.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000099',
        tenantId: '10000000-0000-4000-8000-000000000010',
        dataTypesJson: ['BOOKINGS'],
        branchScopeJson: ['10000000-0000-4000-8000-000000000012'],
        dateFrom: new Date('2031-01-01'),
        dateTo: new Date('2031-01-02'),
        checkpoint: null,
        state: 'RUNNING',
      }),
      listExportRows: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'booking-1' }], nextCursor: 'booking-1' })
        .mockResolvedValueOnce({ rows: [{ id: 'booking-2' }], nextCursor: null }),
      markProgress: vi.fn(),
      markReady: vi.fn(),
      markRetryable: vi.fn(),
      markFailed: vi.fn(),
    };
    const storage = { putObject: vi.fn().mockResolvedValue(undefined) };
    await new ExportRunner(repository as never, storage as never).run({
      tenantId: '10000000-0000-4000-8000-000000000010',
      exportId: '10000000-0000-4000-8000-000000000099',
      workerId: 'worker-a',
    });
    expect(repository.listExportRows).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cursor: null }),
    );
    expect(repository.listExportRows).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: 'booking-1' }),
    );
    expect(repository.markProgress).toHaveBeenCalledWith(
      expect.objectContaining({ progressRows: 2, checkpoint: null }),
    );
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking export PostgreSQL lease claims', () => {
  let databaseA: DatabaseClient;
  let databaseB: DatabaseClient;
  let fixture: BookingLiveFixture;

  beforeAll(async () => {
    databaseA = createDatabaseClient(databaseUrl!);
    databaseB = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(databaseA);
  });

  afterAll(async () => {
    await databaseA.exportRequest.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(databaseA, fixture);
    await databaseA.$disconnect();
    await databaseB.$disconnect();
  });

  it('allows one live worker owner and permits reclaim only after lease expiry', async () => {
    const request = await new ExportRepository(databaseA).createOrGetRequest({
      tenantId: fixture.tenantId,
      requesterMembershipId: fixture.membershipId,
      idempotencyKey: 'live-export-lease-123456',
      correlationId: 'live-export-lease',
      requestHash: 'b'.repeat(64),
      format: 'XLSX',
      dataTypes: ['BOOKINGS'],
      dateFrom: new Date('2031-01-01T00:00:00.000Z'),
      dateTo: new Date('2031-01-02T00:00:00.000Z'),
      branchIds: [fixture.branchId],
    });
    const now = new Date('2031-01-01T00:00:00.000Z');
    const [claimA, claimB] = await Promise.all([
      new ExportRepository(databaseA).claimExport({
        tenantId: fixture.tenantId,
        exportId: request.id,
        workerId: 'live-worker-a',
        now,
        leaseMs: 60_000,
      }),
      new ExportRepository(databaseB).claimExport({
        tenantId: fixture.tenantId,
        exportId: request.id,
        workerId: 'live-worker-b',
        now,
        leaseMs: 60_000,
      }),
    ]);
    expect([claimA, claimB].filter(Boolean)).toHaveLength(1);
    const reclaimed = await new ExportRepository(databaseB).claimExport({
      tenantId: fixture.tenantId,
      exportId: request.id,
      workerId: 'live-worker-b',
      now: new Date('2031-01-01T00:02:00.000Z'),
      leaseMs: 60_000,
    });
    expect(reclaimed?.leaseOwner).toBe('live-worker-b');
  });

  it('keeps independent source cursors and applies retry backoff before final failure', async () => {
    const repository = new ExportRepository(databaseA);
    const mediaId = randomUUID();
    await databaseA.mediaObject.create({
      data: {
        tenantId: fixture.tenantId,
        id: mediaId,
        ownerMembershipId: fixture.membershipId,
        branchId: fixture.branchId,
        sourceType: 'BOOKING',
        sourceId: fixture.bookingId,
        purpose: 'CUSTOMER_BOOKING_PHOTO',
        storageProvider: 'test',
        bucket: 'test',
        objectKey: `${fixture.tenantId}/test/${mediaId}.jpg`,
        contentType: 'image/jpeg',
        byteSize: 1,
        checksumSha256: 'a'.repeat(64),
        status: 'READY',
        uploadExpiresAt: new Date('2031-01-20T00:00:00.000Z'),
        readyAt: new Date('2031-01-15T00:00:00.000Z'),
      },
    });
    await databaseA.tourCompletion.create({
      data: {
        tenantId: fixture.tenantId,
        branchId: fixture.branchId,
        bookingId: fixture.bookingId,
        customerId: fixture.customerId,
        performedByMembershipId: fixture.membershipId,
        serviceOfferingId: fixture.serviceOfferingId,
        customerPhotoMediaId: mediaId,
        businessDate: new Date('2031-01-15T00:00:00.000Z'),
        sourceEventId: randomUUID(),
      },
    });
    const page = await repository.listExportRows({
      tenantId: fixture.tenantId,
      branchIds: [fixture.branchId],
      dateFrom: new Date('2031-01-15T00:00:00.000Z'),
      dateTo: new Date('2031-01-15T00:00:00.000Z'),
      dataTypes: ['BOOKINGS', 'TOURS'],
      take: 1,
    });
    expect(page.rows.map((row) => row.dataType)).toEqual(
      expect.arrayContaining(['BOOKINGS', 'TOURS']),
    );
    expect(page.nextCursors).toBeDefined();

    const request = await repository.createOrGetRequest({
      tenantId: fixture.tenantId,
      requesterMembershipId: fixture.membershipId,
      idempotencyKey: `live-export-retry-${randomUUID()}`,
      correlationId: 'live-export-retry',
      requestHash: 'd'.repeat(64),
      format: 'XLSX',
      dataTypes: ['BOOKINGS'],
      dateFrom: new Date('2031-01-01T00:00:00.000Z'),
      dateTo: new Date('2031-01-02T00:00:00.000Z'),
      branchIds: [fixture.branchId],
    });
    const startedAt = new Date('2031-01-01T00:00:00.000Z');
    const claimed = await repository.claimExport({
      tenantId: fixture.tenantId,
      exportId: request.id,
      workerId: 'retry-worker',
      now: startedAt,
    });
    expect(claimed).not.toBeNull();
    await repository.markRetryable({
      tenantId: fixture.tenantId,
      exportId: request.id,
      workerId: 'retry-worker',
      code: 'TRANSIENT',
      now: startedAt,
    });
    const retryable = await repository.getExport(fixture.tenantId, request.id);
    expect(retryable?.state).toBe('RETRYABLE');
    expect(retryable?.nextAttemptAt).toBeInstanceOf(Date);
    expect(
      await repository.claimExport({
        tenantId: fixture.tenantId,
        exportId: request.id,
        workerId: 'too-early',
        now: startedAt,
      }),
    ).toBeNull();

    let nextAttemptAt = retryable?.nextAttemptAt as Date;
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      const retryClaim = await repository.claimExport({
        tenantId: fixture.tenantId,
        exportId: request.id,
        workerId: `retry-worker-${attempt}`,
        now: new Date(nextAttemptAt.getTime() + 1),
      });
      expect(retryClaim).not.toBeNull();
      await repository.markRetryable({
        tenantId: fixture.tenantId,
        exportId: request.id,
        workerId: `retry-worker-${attempt}`,
        code: 'TRANSIENT',
        now: new Date(nextAttemptAt.getTime() + 1),
      });
      const afterAttempt = await repository.getExport(fixture.tenantId, request.id);
      if (attempt < 5) {
        expect(afterAttempt?.state).toBe('RETRYABLE');
        nextAttemptAt = afterAttempt?.nextAttemptAt as Date;
      } else {
        expect(afterAttempt?.state).toBe('FAILED');
        expect(afterAttempt?.nextAttemptAt).toBeNull();
      }
    }
  });
});
