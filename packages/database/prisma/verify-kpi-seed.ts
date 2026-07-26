import { pathToFileURL } from 'node:url';
import { createDatabaseClient, type DatabaseClient } from '../src/client.js';

export const sampleTenantId = '10000000-0000-4000-8000-000000000001';
const kpiPermissionCodes = [
  'kpi.view',
  'kpi.configure',
  'kpi.target.manage',
  'kpi.policy.manage',
  'kpi.report.submit',
  'kpi.evaluation.view',
  'kpi.evaluation.rerun',
  'kpi.penalty.adjust',
];

export async function verifyKpiSeed(db: DatabaseClient) {
  const [
    tenant,
    memberships,
    assignments,
    definitions,
    targets,
    mappings,
    policies,
    forms,
    permissions,
  ] = await Promise.all([
    db.tenant.findUnique({ where: { id: sampleTenantId } }),
    db.tenantMembership.findMany({
      where: { tenantId: sampleTenantId, status: 'ACTIVE' },
      select: { id: true },
    }),
    db.assignment.findMany({
      where: {
        tenantId: sampleTenantId,
        status: 'ACTIVE',
        effectiveFrom: { lte: new Date('2026-07-19T12:00:00.000Z') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date('2026-07-19T12:00:00.000Z') } }],
      },
      select: { membershipId: true, branchId: true },
    }),
    db.kpiDefinition.findMany({
      where: { tenantId: sampleTenantId },
      select: { code: true },
      orderBy: { code: 'asc' },
    }),
    db.kpiTargetVersion.count({ where: { tenantId: sampleTenantId } }),
    db.kpiSourceMappingVersion.count({ where: { tenantId: sampleTenantId } }),
    db.dailyKpiPolicyVersion.count({ where: { tenantId: sampleTenantId } }),
    db.formTemplate.count({ where: { tenantId: sampleTenantId, status: 'ACTIVE' } }),
    db.permission.count({ where: { code: { in: kpiPermissionCodes } } }),
  ]);
  const assignmentsByMember = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const branches = assignmentsByMember.get(assignment.membershipId) ?? new Set<string>();
    branches.add(assignment.branchId);
    assignmentsByMember.set(assignment.membershipId, branches);
  }
  const result = {
    tenantName: tenant?.name,
    memberships: memberships.length,
    membershipsWithOneBranch: memberships.filter(
      (membership) => assignmentsByMember.get(membership.id)?.size === 1,
    ).length,
    definitions: definitions.map((item) => item.code),
    targets,
    mappings,
    policies,
    forms,
    permissions,
  };
  const expectedCodes = ['COMPLETED_TASKS', 'DAILY_REVENUE', 'ON_TIME_RATE'];
  if (
    result.tenantName !== 'Công ty TNHH ABC' ||
    result.memberships !== 30 ||
    result.membershipsWithOneBranch !== 30 ||
    JSON.stringify(result.definitions) !== JSON.stringify(expectedCodes) ||
    result.targets !== 3 ||
    result.mappings !== 3 ||
    result.policies !== 1 ||
    result.forms !== 4 ||
    result.permissions !== kpiPermissionCodes.length
  ) {
    throw new Error(`KPI seed verification failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createDatabaseClient(databaseUrl);
  try {
    const result = await verifyKpiSeed(db);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
