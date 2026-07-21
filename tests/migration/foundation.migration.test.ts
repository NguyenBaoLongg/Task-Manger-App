import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/database/prisma/migrations/202607190001_foundation/migration.sql',
  import.meta.url,
);
const seedPath = new URL('../../packages/database/prisma/seed.ts', import.meta.url);
const existingMemberInvitationMigrationPath = new URL(
  '../../packages/database/prisma/migrations/202607190004_existing_member_invitations/migration.sql',
  import.meta.url,
);
const requiredAuditReasonsMigrationPath = new URL(
  '../../packages/database/prisma/migrations/202607190005_required_audit_reasons/migration.sql',
  import.meta.url,
);

describe('foundation migration and seed', () => {
  it('contains every tenant boundary and reviewed check constraint', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const table of [
      'tenant_memberships',
      'membership_role_bindings',
      'form_versions',
      'chat_messages',
      'media_objects',
      'audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(sql).toContain('role_binding_scope_ck');
    expect(sql).toContain('media_objects_tenant_key_ck');
    expect(sql).toContain('FOREIGN KEY ("tenant_id", "membership_id")');
  });

  it('uses stable upserts and creates 30 memberships idempotently', async () => {
    const seed = await readFile(seedPath, 'utf8');
    expect(seed).toContain("name: 'Công ty TNHH ABC'");
    expect(seed).toContain('for (let index = 2; index <= 30; index += 1)');
    expect((seed.match(/\.upsert\(/g) ?? []).length).toBeGreaterThan(5);
    expect(seed.indexOf("'tenant.manage'")).toBeGreaterThan(seed.indexOf("'audit.read'"));
  });

  it('allows one existing membership to accept different invitations', async () => {
    const sql = await readFile(existingMemberInvitationMigrationPath, 'utf8');
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "invitation_acceptances_tenant_id_membership_id_key"',
    );
  });

  it('backfills and enforces a reason for every audit event', async () => {
    const sql = await readFile(requiredAuditReasonsMigrationPath, 'utf8');
    expect(sql).toContain('WHERE "reason" IS NULL');
    expect(sql).toContain('ALTER COLUMN "reason" SET NOT NULL');
  });
});
