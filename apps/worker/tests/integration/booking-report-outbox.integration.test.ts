import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingReportReadyEventSchema } from '../../../../packages/contracts/src/booking.js';
import {
  BookingWorkerRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import {
  cleanupBookingLiveFixture,
  createBookingLiveFixture,
  type BookingLiveFixture,
} from '../../../api/tests/helpers/booking-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('booking report ready outbox contract', () => {
  let database: DatabaseClient;
  let fixture: BookingLiveFixture;

  beforeAll(async () => {
    database = createDatabaseClient(databaseUrl!);
    fixture = await createBookingLiveFixture(database);
  });

  afterAll(async () => {
    await database.outboxEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.bookingJobRun.deleteMany({ where: { tenantId: fixture.tenantId } });
    await database.auditEvent.deleteMany({ where: { tenantId: fixture.tenantId } });
    await cleanupBookingLiveFixture(database, fixture);
    await database.$disconnect();
  });

  it('emits the actual rendered hash and destination count in booking.report-ready.v1', async () => {
    const repository = new BookingWorkerRepository(database);
    const run = await repository.ensureReportRun({
      tenantId: fixture.tenantId,
      reportType: 'TODAY_OUTCOME',
      businessDate: new Date('2031-01-15T00:00:00.000Z'),
      branchIds: [fixture.branchId],
      correlationId: 'us4-ready-contract',
    });
    const claimed = await repository.claimReportRun({
      tenantId: fixture.tenantId,
      runId: run.id,
      leaseOwner: 'ready-contract-worker',
      now: new Date('2031-01-15T15:00:00.000Z'),
      leaseDurationMs: 60_000,
    });
    expect(claimed).not.toBeNull();
    const contentHash = 'b'.repeat(64);
    await repository.completeReportRun({
      tenantId: fixture.tenantId,
      runId: run.id,
      leaseOwner: 'ready-contract-worker',
      now: new Date('2031-01-15T15:01:00.000Z'),
      checkpoint: 'destinations:2',
      contentHash,
      destinationCount: 2,
    });
    const outbox = await database.outboxEvent.findFirstOrThrow({
      where: { tenantId: fixture.tenantId, eventType: 'booking.report-ready.v1' },
    });
    expect(outbox.aggregateType).toBe('BOOKING');
    const payload = outbox.payloadRedacted as Record<string, unknown>;
    const event = bookingReportReadyEventSchema.parse({
      eventId: outbox.id,
      eventType: outbox.eventType,
      schemaVersion: outbox.schemaVersion,
      tenantId: fixture.tenantId,
      branchId: null,
      aggregateType: outbox.aggregateType,
      aggregateId: run.id,
      occurredAt: outbox.createdAt.toISOString(),
      correlationId: outbox.correlationId,
      actorMembershipId: null,
      payload,
    });
    expect(event.payload.contentHash).toBe(contentHash);
    expect(event.payload.destinationCount).toBe(2);
  });
});
