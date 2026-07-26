import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExportRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { ExportRunner } from '../../src/exports/export-runner.js';
import { LocalExportStorage } from '../../src/exports/export-storage.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

type ReadyPayload = { rowCount: number; content: Buffer; checksumSha256: string };

describe('booking XLSX export runner', () => {
  it('streams rows, records checksum/row count and retries without a duplicate object key', async () => {
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
      listExportRows: vi.fn().mockResolvedValue({
        rows: [{ id: 'booking-1', branchId: 'branch-1', customer: '=2+2' }],
        nextCursor: null,
      }),
      markProgress: vi.fn(),
      markReady: vi.fn(),
      markRetryable: vi.fn(),
      markFailed: vi.fn(),
    };
    const storage = { putObject: vi.fn().mockResolvedValue(undefined) };
    const runner = new ExportRunner(repository as never, storage as never);
    await runner.run({
      tenantId: '10000000-0000-4000-8000-000000000010',
      exportId: '10000000-0000-4000-8000-000000000099',
      workerId: 'worker-a',
    });
    const ready = repository.markReady.mock.calls[0]?.[0] as ReadyPayload;
    expect(ready.rowCount).toBe(1);
    expect(ready.checksumSha256).toBe(createHash('sha256').update(ready.content).digest('hex'));
    const storedObject = storage.putObject.mock.calls[0]?.[0] as { objectKey: string };
    expect(storedObject.objectKey).toContain('/exports/');
    expect(repository.markRetryable).not.toHaveBeenCalled();
  });

  it('writes metadata plus deterministic sheets and reconciles each source row count', async () => {
    const repository = {
      claimExport: vi.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000100',
        tenantId: '10000000-0000-4000-8000-000000000010',
        requesterMembershipId: '10000000-0000-4000-8000-000000000011',
        dataTypesJson: ['BOOKINGS', 'TOURS'],
        branchScopeJson: ['10000000-0000-4000-8000-000000000012'],
        dateFrom: new Date('2031-01-01'),
        dateTo: new Date('2031-01-02'),
        checkpoint: null,
        correlationId: 'export-manifest',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
      countExportRows: vi.fn().mockResolvedValue({ BOOKINGS: 1, TOURS: 1 }),
      listExportRows: vi.fn(async ({ dataTypes }: { dataTypes: string[] }) => ({
        rows:
          dataTypes[0] === 'BOOKINGS'
            ? [{ id: 'booking-1', branchId: 'branch-1', status: 'SCHEDULED' }]
            : [{ id: 'tour-1', branchId: 'branch-1', bookingId: 'booking-1' }],
        nextCursor: null,
      })),
      markProgress: vi.fn(),
      markReady: vi.fn(),
      markRetryable: vi.fn(),
    };
    const storage = { putObject: vi.fn().mockResolvedValue(undefined) };
    const writer = vi.fn().mockResolvedValue(Buffer.from('xlsx'));
    const runner = new ExportRunner(repository as never, storage as never, writer);

    await runner.run({
      tenantId: '10000000-0000-4000-8000-000000000010',
      exportId: '10000000-0000-4000-8000-000000000100',
      workerId: 'worker-a',
      now: new Date('2031-01-01T01:00:00.000Z'),
    });

    const workbookInput = writer.mock.calls[0]?.[0] as {
      sheets: Array<{ name: string; rows: unknown[][] }>;
    };
    expect(workbookInput.sheets.map((sheet) => sheet.name)).toEqual([
      'Metadata',
      'Bookings',
      'Tours',
    ]);
    expect(workbookInput.sheets[0]?.rows).toEqual(
      expect.arrayContaining([
        ['generatedAt', '2031-01-01T01:00:00.000Z'],
        ['timezone', 'Asia/Ho_Chi_Minh'],
        ['dataTypes', 'BOOKINGS,TOURS'],
      ]),
    );
    expect(repository.markReady).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 2 }));
  });

  it('keeps zero-row selected sources in the workbook and reconciles them exactly', async () => {
    const repository = {
      claimExport: vi.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000101',
        tenantId: '10000000-0000-4000-8000-000000000010',
        requesterMembershipId: '10000000-0000-4000-8000-000000000011',
        dataTypesJson: ['KPI'],
        branchScopeJson: ['10000000-0000-4000-8000-000000000012'],
        dateFrom: new Date('2031-01-01'),
        dateTo: new Date('2031-01-02'),
        checkpoint: null,
        correlationId: 'export-empty',
      }),
      countExportRows: vi.fn().mockResolvedValue({ KPI: 0 }),
      listExportRows: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
      markProgress: vi.fn(),
      markReady: vi.fn(),
      markRetryable: vi.fn(),
    };
    const writer = vi.fn().mockResolvedValue(Buffer.from('xlsx'));
    await new ExportRunner(
      repository as never,
      { putObject: vi.fn().mockResolvedValue(undefined) } as never,
      writer,
    ).run({
      tenantId: '10000000-0000-4000-8000-000000000010',
      exportId: '10000000-0000-4000-8000-000000000101',
      workerId: 'worker-a',
    });
    const workbookInput = writer.mock.calls[0]?.[0] as {
      sheets: Array<{ name: string; rows: unknown[][] }>;
    };
    expect(workbookInput.sheets.map((sheet) => sheet.name)).toEqual(['Metadata', 'Kpi']);
    expect(repository.markReady).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 0 }));
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking XLSX export PostgreSQL lifecycle', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;
  let exportRoot: string;

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
    exportRoot = await mkdtemp(join(tmpdir(), 'adsup-export-live-'));
  });

  afterAll(async () => {
    await database.exportRequest.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
    await rm(exportRoot, { recursive: true, force: true });
  });

  it('creates a real XLSX media artifact and ready outbox record', async () => {
    const repository = new ExportRepository(database);
    const request = await repository.createOrGetRequest({
      tenantId: fixture.tenantId,
      requesterMembershipId: fixture.membershipId,
      idempotencyKey: 'live-export-run-123456',
      correlationId: 'live-export-run',
      requestHash: 'c'.repeat(64),
      format: 'XLSX',
      dataTypes: ['BOOKINGS', 'TOURS'],
      dateFrom: new Date('2031-01-15T00:00:00.000Z'),
      dateTo: new Date('2031-01-15T00:00:00.000Z'),
      branchIds: [fixture.branchId],
    });
    const result = await new ExportRunner(repository, new LocalExportStorage(exportRoot)).run({
      tenantId: fixture.tenantId,
      exportId: request.id,
      workerId: 'live-export-worker',
      now: new Date('2031-01-15T12:00:00.000Z'),
    });
    expect(result.rowCount).toBeGreaterThan(0);
    const saved = await repository.getExport(fixture.tenantId, request.id);
    expect(saved?.state).toBe('READY');
    expect(saved?.mediaObject?.purpose).toBe('REPORT_XLSX');
    expect(saved?.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    const file = await readFile(
      join(exportRoot, fixture.tenantId, 'exports', `${request.id}.xlsx`),
    );
    expect(file.subarray(0, 2).toString()).toBe('PK');
  });
});
