import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AttendanceRepository, createDatabaseClient, type DatabaseClient } from '@adsup/database';
import { FixedClock } from '@adsup/testing';
import { ScheduleService } from '../../src/modules/attendance/schedule-service.js';
import {
  cleanupTimekeepingLiveFixture,
  createTimekeepingLiveFixture,
  type TimekeepingLiveFixture,
} from '../helpers/timekeeping-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('attendance schedule tenant and branch isolation', () => {
  let db: DatabaseClient;
  let fixture: TimekeepingLiveFixture;
  let other: TimekeepingLiveFixture;
  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    fixture = await createTimekeepingLiveFixture(db);
    other = await createTimekeepingLiveFixture(db);
  });
  afterAll(async () => {
    await cleanupTimekeepingLiveFixture(db, other);
    await cleanupTimekeepingLiveFixture(db, fixture);
    await db.$disconnect();
  });

  it('rejects a shift definition from another tenant', async () => {
    const service = new ScheduleService(
      new AttendanceRepository(db),
      new FixedClock(new Date('2026-07-19T00:00:00.000Z')),
    );
    await expect(
      service.createOrEditMySchedule({
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.employeeMembershipId,
        correlationId: 'schedule-foreign-shift',
        businessDate: '2026-07-22',
        shiftDefinitionId: other.shiftIds[0],
        reason: 'Foreign shift should fail',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('returns only schedules for the requested tenant and branch', async () => {
    const service = new ScheduleService(
      new AttendanceRepository(db),
      new FixedClock(new Date('2026-07-19T00:00:00.000Z')),
    );
    await service.createOrEditMySchedule({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.employeeMembershipId,
      correlationId: 'schedule-branch-filter',
      businessDate: '2026-07-23',
      shiftDefinitionId: fixture.shiftIds[0],
      reason: 'Branch-filtered schedule',
    });
    const repository = new AttendanceRepository(db);
    const visible = await repository.listSchedules({
      tenantId: fixture.tenantId,
      branchId: fixture.branchIds[0],
      dateFrom: new Date('2026-07-23T00:00:00.000Z'),
      dateTo: new Date('2026-07-23T00:00:00.000Z'),
    });
    const hidden = await repository.listSchedules({
      tenantId: fixture.tenantId,
      branchId: fixture.branchIds[1],
      dateFrom: new Date('2026-07-23T00:00:00.000Z'),
      dateTo: new Date('2026-07-23T00:00:00.000Z'),
    });
    expect(visible).toHaveLength(1);
    expect(hidden).toHaveLength(0);
  });
});
