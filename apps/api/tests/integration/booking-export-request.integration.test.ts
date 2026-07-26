import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExportRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { ExportService } from '../../src/modules/bookings/export-service.js';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../helpers/booking-live-fixture.js';

const tenantId = '10000000-0000-4000-8000-000000000010';
const membershipId = '10000000-0000-4000-8000-000000000011';
const branchId = '10000000-0000-4000-8000-000000000012';

const input = {
  format: 'XLSX' as const,
  dataTypes: ['BOOKINGS' as const],
  dateFrom: '2031-01-01',
  dateTo: '2031-01-02',
  branchIds: [branchId],
};

type RequestInput = {
  tenantId: string;
  requesterMembershipId: string;
  idempotencyKey: string;
  correlationId: string;
  requestHash: string;
  format: 'XLSX';
  dataTypes: readonly string[];
  dateFrom: Date;
  dateTo: Date;
  branchIds: string[];
};

type RequestRecord = RequestInput & {
  id: string;
  state: string;
  createdAt: Date;
};

describe('booking export request isolation and idempotency', () => {
  it('replays the same request and conflicts on a changed payload', async () => {
    const requests = new Map<string, RequestRecord>();
    const repository = {
      createOrGetRequest: vi.fn(async (request: RequestInput): Promise<RequestRecord> => {
        const key = `${request.tenantId}:${request.requesterMembershipId}:${request.idempotencyKey}`;
        const existing = requests.get(key);
        if (existing) return existing;
        const created = {
          id: '10000000-0000-4000-8000-000000000099',
          ...request,
          state: 'PENDING',
          createdAt: new Date(),
        };
        requests.set(key, created);
        return created;
      }),
    };
    const authorization = { hasPermission: vi.fn().mockResolvedValue(true) };
    const service = new ExportService(repository as never, authorization as never);
    const first = await service.create({
      tenantId,
      actorMembershipId: membershipId,
      allowedBranchIds: [branchId],
      idempotencyKey: 'request-123456',
      correlationId: 'export-request',
      input,
    });
    const replay = await service.create({
      tenantId,
      actorMembershipId: membershipId,
      allowedBranchIds: [branchId],
      idempotencyKey: 'request-123456',
      correlationId: 'export-request',
      input,
    });
    expect(replay.export.id).toBe(first.export.id);
    await expect(
      service.create({
        tenantId,
        actorMembershipId: membershipId,
        allowedBranchIds: [branchId],
        idempotencyKey: 'request-123456',
        correlationId: 'export-request',
        input: { ...input, dateTo: '2031-01-03' },
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('rejects a branch outside the actor scope before persistence', async () => {
    const repository = { createOrGetRequest: vi.fn() };
    const service = new ExportService(repository as never, { hasPermission: vi.fn() } as never);
    await expect(
      service.create({
        tenantId,
        actorMembershipId: membershipId,
        allowedBranchIds: ['10000000-0000-4000-8000-000000000013'],
        idempotencyKey: 'request-123456',
        correlationId: 'export-request',
        input,
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
    expect(repository.createOrGetRequest).not.toHaveBeenCalled();
  });

  it('audits a newly created request inside the persistence transaction', async () => {
    const created = {
      id: '10000000-0000-4000-8000-000000000099',
      requestHash: 'a'.repeat(64),
    };
    const auditCreate = vi.fn();
    const database = {
      exportRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue(created),
      },
      $transaction: vi.fn(
        async (
          operation: (transaction: {
            exportRequest: { create: () => Promise<typeof created> };
            auditEvent: { create: (input: unknown) => Promise<unknown> };
          }) => Promise<unknown>,
        ) =>
          operation({
            exportRequest: { create: vi.fn().mockResolvedValue(created) },
            auditEvent: { create: auditCreate.mockResolvedValue({}) },
          }),
      ),
    };
    const repository = new ExportRepository(database as never);

    await repository.createOrGetRequest({
      tenantId,
      requesterMembershipId: membershipId,
      idempotencyKey: 'request-audit-123456',
      correlationId: 'export-audit-request',
      requestHash: created.requestHash,
      format: 'XLSX',
      dataTypes: ['BOOKINGS'],
      dateFrom: new Date('2031-01-01T00:00:00.000Z'),
      dateTo: new Date('2031-01-02T00:00:00.000Z'),
      branchIds: [branchId],
    });

    const auditCall = auditCreate.mock.calls[0]?.[0] as {
      data: { eventType: string; targetId: string; reason: string };
    };
    expect(auditCall.data.eventType).toBe('EXPORT_REQUESTED');
    expect(auditCall.data.targetId).toBe(created.id);
    expect(auditCall.data.reason).toBe('EXPORT_REQUEST_CREATED');
  });
});

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking export request PostgreSQL persistence', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });

  afterAll(async () => {
    await database.exportRequest.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('persists one request per tenant/member/idempotency key and preserves tenant scope', async () => {
    const repository = new ExportRepository(database);
    const first = await repository.createOrGetRequest({
      tenantId: fixture.tenantId,
      requesterMembershipId: fixture.membershipId,
      idempotencyKey: 'live-export-123456',
      correlationId: 'live-export-request',
      requestHash: 'a'.repeat(64),
      format: 'XLSX',
      dataTypes: ['BOOKINGS'],
      dateFrom: new Date('2031-01-01T00:00:00.000Z'),
      dateTo: new Date('2031-01-02T00:00:00.000Z'),
      branchIds: [fixture.branchId],
    });
    const replay = await repository.createOrGetRequest({
      tenantId: fixture.tenantId,
      requesterMembershipId: fixture.membershipId,
      idempotencyKey: 'live-export-123456',
      correlationId: 'live-export-request',
      requestHash: 'a'.repeat(64),
      format: 'XLSX',
      dataTypes: ['BOOKINGS'],
      dateFrom: new Date('2031-01-01T00:00:00.000Z'),
      dateTo: new Date('2031-01-02T00:00:00.000Z'),
      branchIds: [fixture.branchId],
    });
    expect(replay.id).toBe(first.id);
    expect(await database.exportRequest.count({ where: { tenantId: fixture.tenantId } })).toBe(1);
  });
});
