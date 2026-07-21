import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActionItemRepository,
  AttendanceRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@adsup/database';
import { FixedClock } from '@adsup/testing';
import { ScheduleService } from '../../src/modules/attendance/schedule-service.js';
import {
  cleanupTimekeepingLiveFixture,
  createTimekeepingLiveFixture,
  type TimekeepingLiveFixture,
} from '../helpers/timekeeping-live-fixture.js';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('attendance schedule integration', () => {
  let db: DatabaseClient;
  let fixture: TimekeepingLiveFixture;
  beforeAll(async () => {
    db = createDatabaseClient(databaseUrl!);
    fixture = await createTimekeepingLiveFixture(db);
  });
  afterAll(async () => {
    await cleanupTimekeepingLiveFixture(db, fixture);
    await db.$disconnect();
  });

  it('registers and self-edits before cutoff while preserving schedule history', async () => {
    const clock = new FixedClock(new Date('2026-07-19T00:00:00.000Z'));
    const service = new ScheduleService(
      new AttendanceRepository(db),
      clock,
      new ActionItemRepository(db),
    );
    const first = await service.createOrEditMySchedule({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.employeeMembershipId,
      correlationId: 'schedule-first',
      businessDate: '2026-07-21',
      shiftDefinitionId: fixture.shiftIds[0],
      reason: 'Register first shift',
    });
    expect(first).toMatchObject({ versionNumber: 1, state: 'SCHEDULED' });

    const edited = await service.createOrEditMySchedule({
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.employeeMembershipId,
      correlationId: 'schedule-edit',
      businessDate: '2026-07-21',
      shiftDefinitionId: fixture.shiftIds[1],
      reason: 'Change before cutoff',
    });
    expect(edited).toMatchObject({ versionNumber: 2, shiftDefinitionId: fixture.shiftIds[1] });
    expect(
      await db.workScheduleVersion.count({
        where: { tenantId: fixture.tenantId, membershipId: fixture.employeeMembershipId },
      }),
    ).toBe(2);
    expect(
      await db.auditEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'WORK_SCHEDULE_VERSION_CREATED' },
      }),
    ).toBe(2);
    expect(
      await db.outboxEvent.count({
        where: { tenantId: fixture.tenantId, eventType: 'attendance.schedule.version-created' },
      }),
    ).toBe(2);
  });

  it('requires approval inside 24 hours instead of mutating schedule directly', async () => {
    const clock = new FixedClock(new Date('2026-07-20T02:00:00.000Z'));
    const service = new ScheduleService(
      new AttendanceRepository(db),
      clock,
      new ActionItemRepository(db),
    );
    await expect(
      service.createOrEditMySchedule({
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.employeeMembershipId,
        correlationId: 'schedule-approval-required',
        businessDate: '2026-07-21',
        shiftDefinitionId: fixture.shiftIds[0],
        reason: 'Too late to self edit',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    expect(
      await db.actionItem.count({
        where: {
          tenantId: fixture.tenantId,
          ownerMembershipId: fixture.employeeMembershipId,
          sourceType: 'APPROVAL_DECISION_REQUIRED',
        },
      }),
    ).toBe(1);
  });
});
