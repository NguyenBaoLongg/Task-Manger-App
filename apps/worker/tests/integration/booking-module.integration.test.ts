import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BookingWorkerRepository,
  ExportRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { ExportRunner } from '../../src/exports/export-runner.js';
import { LocalExportStorage } from '../../src/exports/export-storage.js';
import { BookingRetentionRunner } from '../../src/bookings/retention-runner.ts';
import {
  createBookingLiveFixture,
  cleanupBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('Module 4 booking to XLSX retention workflow', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  let root: string;

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
    root = await mkdtemp(join(tmpdir(), 'adsup-module4-'));
  });

  afterAll(async () => {
    await database.mediaRetentionTombstone.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.exportRequest.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.mediaObject.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  it('creates a real XLSX artifact and then removes only the expired binary', async () => {
    const repository = new ExportRepository(database);
    const request = await repository.createOrGetRequest({
      tenantId: fixture.tenantId,
      requesterMembershipId: fixture.membershipId,
      idempotencyKey: 'module4-e2e-export-123456',
      correlationId: 'module4-e2e-export',
      requestHash: 'e'.repeat(64),
      format: 'XLSX',
      dataTypes: ['BOOKINGS'],
      dateFrom: new Date('2031-01-15T00:00:00.000Z'),
      dateTo: new Date('2031-01-15T00:00:00.000Z'),
      branchIds: [fixture.branchId],
    });
    const storage = new LocalExportStorage(root);
    const result = await new ExportRunner(repository, storage).run({
      tenantId: fixture.tenantId,
      exportId: request.id,
      workerId: 'module4-e2e-worker',
      now: new Date('2031-01-16T00:00:00.000Z'),
    });
    expect(result.claimed).toBe(true);
    const ready = await repository.getExport(fixture.tenantId, request.id);
    expect(ready?.state).toBe('READY');
    expect(ready?.mediaObjectId).toBeTruthy();
    await database.mediaObject.update({
      where: { tenantId_id: { tenantId: fixture.tenantId, id: ready!.mediaObjectId! } },
      data: { retentionUntil: new Date('2031-01-01T00:00:00.000Z') },
    });
    const deletedKeys: string[] = [];
    const retention = new BookingRetentionRunner(new BookingWorkerRepository(database), {
      async delete(input) {
        deletedKeys.push(input.objectKey);
        await storage.delete(input.objectKey);
      },
    });
    await expect(
      retention.runTenant({
        tenantId: fixture.tenantId,
        now: new Date('2031-01-20T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ deleted: 1 });
    expect(deletedKeys).toHaveLength(1);
    expect((await repository.getExport(fixture.tenantId, request.id))?.state).toBe('READY');
    expect(
      (
        await database.mediaObject.findUnique({
          where: { tenantId_id: { tenantId: fixture.tenantId, id: ready!.mediaObjectId! } },
        })
      )?.status,
    ).toBe('DELETED');
  });
});
