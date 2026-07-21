import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/database/prisma/migrations/202607190006_daily_kpi_engine/migration.sql',
  import.meta.url,
);
const schemaPath = new URL('../../packages/database/prisma/schema.prisma', import.meta.url);
const seedPath = new URL('../../packages/database/prisma/seed.ts', import.meta.url);

describe('Module 2 migration and seed', () => {
  it('creates all historical KPI, penalty, evidence, action and job tables', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const table of [
      'kpi_definitions',
      'kpi_target_versions',
      'daily_kpi_policy_versions',
      'daily_kpi_reports',
      'daily_kpi_evaluations',
      'penalty_outcomes',
      'evidence_debts',
      'action_items',
      'kpi_job_runs',
      'outbox_events',
    ])
      expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it('keeps Module 1 foreign keys and adds tenant-composite Module 2 edges', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).not.toContain('DROP CONSTRAINT "assignment_tenant_fk"');
    expect(sql).toContain('daily_kpi_report_member_fk');
    expect(sql).toContain('FOREIGN KEY ("tenant_id", "membership_id")');
    expect(sql).toContain('daily_kpi_policy_time_ck');
    expect(sql).toContain('penalty_outcome_source_ck');
  });

  it('keeps the employee model extensible while Module 2 resolves one branch safely', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    expect(schema).toContain('model Assignment');
    expect(schema).toContain('model DailyKpiEvaluation');
    expect(schema).not.toContain('BLOCKED_DATA_ERROR');
  });

  it('seeds three KPI definitions, default 100000 VND policy and appended permissions idempotently', async () => {
    const seed = await readFile(seedPath, 'utf8');
    expect(seed).toContain("code: 'DAILY_REVENUE'");
    expect(seed).toContain("code: 'COMPLETED_TASKS'");
    expect(seed).toContain("code: 'ON_TIME_RATE'");
    expect(seed).toContain('failurePenaltyMinor: 100_000n');
    expect(seed).toContain("'kpi.penalty.adjust'");
    expect((seed.match(/\.upsert\(/g) ?? []).length).toBeGreaterThan(15);
  });
});
