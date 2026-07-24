import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { DatabaseClient } from '../src/client.js';

export const sampleTenantId = '10000000-0000-4000-8000-000000000001';

const module3PermissionCodes = [
  'attendance.schedule.self',
  'attendance.schedule.manage',
  'attendance.video-policy.manage',
  'attendance.video.review',
  'attendance.penalty-policy.manage',
  'workflow.configure',
  'workflow.decide',
  'attendance.leave.manage',
  'attendance.off-calendar.manage',
  'attendance.penalty.self',
  'attendance.penalty.payment.manage',
  'attendance.media.legal-hold',
] as const;

export async function verifyTimekeepingSeed(db: DatabaseClient) {
  const [
    shifts,
    videoPolicies,
    attendancePenaltyPolicies,
    workflowDefinitions,
    offCalendarVersions,
    permissions,
  ] = await Promise.all([
    db.shiftDefinition.count({
      where: { tenantId: sampleTenantId, code: { in: ['SHIFT_0830', 'SHIFT_0930'] } },
    }),
    db.videoPolicyVersion.count({ where: { tenantId: sampleTenantId } }),
    db.attendancePenaltyPolicyVersion.count({ where: { tenantId: sampleTenantId } }),
    db.workflowDefinitionVersion.count({ where: { tenantId: sampleTenantId } }),
    db.companyOffCalendarVersion.count({ where: { tenantId: sampleTenantId } }),
    db.permission.count({ where: { code: { in: [...module3PermissionCodes] } } }),
  ]);

  return {
    tenantId: sampleTenantId,
    shifts,
    videoPolicies,
    attendancePenaltyPolicies,
    workflowDefinitions,
    offCalendarVersions,
    permissions,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const result = await verifyTimekeepingSeed(prisma);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
