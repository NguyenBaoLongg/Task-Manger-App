import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@adsup/database';

export interface TimekeepingLiveFixture {
  tenantId: string;
  ownerUserId: string;
  employeeUserId: string;
  ownerMembershipId: string;
  employeeMembershipId: string;
  branchIds: [string, string];
  shiftIds: [string, string];
}

export async function createTimekeepingLiveFixture(
  db: DatabaseClient,
): Promise<TimekeepingLiveFixture> {
  const tenantId = randomUUID();
  const ownerUserId = randomUUID();
  const employeeUserId = randomUUID();
  const ownerMembershipId = randomUUID();
  const employeeMembershipId = randomUUID();
  const branchIds: [string, string] = [randomUUID(), randomUUID()];
  const shiftIds: [string, string] = [randomUUID(), randomUUID()];
  await db.user.createMany({
    data: [
      { id: ownerUserId, fullName: 'Timekeeping Owner', fullNameConfirmedAt: new Date() },
      { id: employeeUserId, fullName: 'Timekeeping Employee', fullNameConfirmedAt: new Date() },
    ],
  });
  await db.tenant.create({
    data: {
      id: tenantId,
      name: 'Timekeeping Live Fixture',
      slug: `timekeeping-live-${tenantId.slice(0, 8)}`,
      createdByUserId: ownerUserId,
    },
  });
  await db.tenantMembership.createMany({
    data: [
      {
        tenantId,
        id: ownerMembershipId,
        userId: ownerUserId,
        membershipDisplayName: 'Owner',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
      {
        tenantId,
        id: employeeMembershipId,
        userId: employeeUserId,
        membershipDisplayName: 'Employee',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    ],
  });
  await db.branch.createMany({
    data: [
      {
        tenantId,
        id: branchIds[0],
        code: 'B1',
        name: 'Branch 1',
        createdByMembershipId: ownerMembershipId,
      },
      {
        tenantId,
        id: branchIds[1],
        code: 'B2',
        name: 'Branch 2',
        createdByMembershipId: ownerMembershipId,
      },
    ],
  });
  await db.assignment.create({
    data: {
      tenantId,
      membershipId: employeeMembershipId,
      branchId: branchIds[0],
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
      reason: 'Timekeeping live single branch',
    },
  });
  await db.shiftDefinition.createMany({
    data: [
      {
        tenantId,
        id: shiftIds[0],
        code: 'SHIFT_0830',
        name: 'Ca 1 - 08:30',
        startLocalTime: '08:30',
        timezone: 'Asia/Ho_Chi_Minh',
        effectiveFromDate: new Date('2026-01-01T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: ownerMembershipId,
        reason: 'Live shift',
      },
      {
        tenantId,
        id: shiftIds[1],
        code: 'SHIFT_0930',
        name: 'Ca 2 - 09:30',
        startLocalTime: '09:30',
        timezone: 'Asia/Ho_Chi_Minh',
        effectiveFromDate: new Date('2026-01-01T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: ownerMembershipId,
        reason: 'Live shift',
      },
    ],
  });
  return {
    tenantId,
    ownerUserId,
    employeeUserId,
    ownerMembershipId,
    employeeMembershipId,
    branchIds,
    shiftIds,
  };
}

export async function cleanupTimekeepingLiveFixture(
  db: DatabaseClient,
  fixture: TimekeepingLiveFixture,
) {
  const tenantId = fixture.tenantId;
  await db.outboxEvent.deleteMany({ where: { tenantId } });
  await db.actionItemTransition.deleteMany({ where: { tenantId } });
  await db.actionItem.deleteMany({ where: { tenantId } });
  await db.approvalDecisionRecord.deleteMany({ where: { tenantId } });
  await db.approvalRunStep.deleteMany({ where: { tenantId } });
  await db.leaveConflictSnapshot.deleteMany({ where: { tenantId } });
  await db.approvalRequest.deleteMany({ where: { tenantId } });
  await db.workScheduleVersion.deleteMany({ where: { tenantId } });
  await db.workflowDefinitionVersion.deleteMany({ where: { tenantId } });
  await db.companyOffCalendarVersion.deleteMany({ where: { tenantId } });
  await db.shiftDefinition.deleteMany({ where: { tenantId } });
  await db.auditEvent.deleteMany({ where: { tenantId } });
  await db.assignment.deleteMany({ where: { tenantId } });
  await db.branch.deleteMany({ where: { tenantId } });
  await db.tenantMembership.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.user.deleteMany({
    where: { id: { in: [fixture.ownerUserId, fixture.employeeUserId] } },
  });
}
