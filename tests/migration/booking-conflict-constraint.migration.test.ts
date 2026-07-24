import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/database/prisma/migrations/202607240001_booking_export/migration.sql',
  import.meta.url,
);

describe('Module 4 booking constraints', () => {
  it('uses btree_gist and a partial half-open 60-minute exclusion constraint', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS btree_gist');
    expect(sql).toContain('booking_active_employee_60m_excl');
    expect(sql).toContain("interval '60 minutes'");
    expect(sql).toContain("'[)'");
    expect(sql).toContain('"booking_type" = \'SCHEDULED\'');
    expect(sql).toContain('"status" IN (\'SCHEDULED\', \'ARRIVED\')');
  });

  it('declares composite tenant foreign keys and retry-safe uniqueness', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const fragment of [
      'FOREIGN KEY ("tenant_id", "branch_id")',
      'FOREIGN KEY ("tenant_id", "customer_id")',
      'FOREIGN KEY ("tenant_id", "assigned_membership_id")',
      'booking_transition_source_event_uniq',
      'customer_photo_debt_booking_uniq',
      'tour_completion_booking_uniq',
      'booking_report_delivery_dedupe_uniq',
      'export_request_actor_idempotency_uniq',
    ])
      expect(sql).toContain(fragment);
  });
});
