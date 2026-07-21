import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '../../packages/database/src/client.js';
import {
  sampleTenantId,
  verifyTimekeepingSeed,
} from '../../packages/database/prisma/verify-timekeeping-seed.js';

const seedPath = new URL('../../packages/database/prisma/seed.ts', import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

describe('Module 3 deterministic seed source', () => {
  it('seeds permissions, default shifts, policy versions, workflows and OFF examples idempotently', async () => {
    const seed = await readFile(seedPath, 'utf8');
    for (const expected of [
      "'attendance.schedule.self'",
      "'attendance.schedule.manage'",
      "'attendance.video-policy.manage'",
      "'attendance.video.review'",
      "'attendance.penalty-policy.manage'",
      "'workflow.configure'",
      "'workflow.decide'",
      "'attendance.leave.manage'",
      "'attendance.off-calendar.manage'",
      "'attendance.penalty.payment.manage'",
      "'attendance.media.legal-hold'",
      "code: 'SHIFT_0830'",
      "code: 'SHIFT_0930'",
      'videoPolicyVersion.upsert',
      'attendancePenaltyPolicyVersion.upsert',
      'workflowDefinitionVersion.upsert',
      'companyOffCalendarVersion.upsert',
    ])
      expect(seed).toContain(expected);
  });
});

live('deterministic Module 3 sample seed', () => {
  let db: DatabaseClient;
  beforeAll(() => {
    db = createDatabaseClient(databaseUrl!);
  });
  afterAll(async () => db.$disconnect());

  it('verifies seeded Module 3 data can be rerun without duplicates', async () => {
    await expect(verifyTimekeepingSeed(db)).resolves.toMatchObject({
      tenantId: sampleTenantId,
      shifts: 2,
      videoPolicies: 1,
      attendancePenaltyPolicies: 1,
      workflowDefinitions: 4,
      offCalendarVersions: 2,
      permissions: 11,
    });
  });
});
