import assert from 'node:assert/strict';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const tenantId = '10000000-0000-4000-8000-000000000001';

const counts = {
  tenant: await prisma.tenant.count({ where: { id: tenantId, name: 'Công ty TNHH ABC' } }),
  memberships: await prisma.tenantMembership.count({ where: { tenantId } }),
  branches: await prisma.branch.count({ where: { tenantId } }),
  departments: await prisma.department.count({ where: { tenantId } }),
  positions: await prisma.position.count({ where: { tenantId } }),
  roles: await prisma.role.count({ where: { tenantId } }),
  assignments: await prisma.assignment.count({ where: { tenantId } }),
  bindings: await prisma.membershipRoleBinding.count({ where: { tenantId } }),
  generalChannels: await prisma.chatChannel.count({ where: { tenantId, type: 'TENANT_GENERAL' } }),
};

assert.deepEqual(counts, {
  tenant: 1,
  memberships: 30,
  branches: 3,
  departments: 4,
  positions: 3,
  roles: 3,
  assignments: 29,
  bindings: 30,
  generalChannels: 1,
});
console.log('SEED_COUNTS_OK', JSON.stringify(counts));
await prisma.$disconnect();
