import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/database/prisma/migrations/202607210001_timekeeping_workflows/migration.sql',
  import.meta.url,
);
const schemaPath = new URL('../../packages/database/prisma/schema.prisma', import.meta.url);

describe('Module 3 timekeeping migration', () => {
  it('creates all tenant-scoped schedule, attendance, workflow, penalty and job tables', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const table of [
      'shift_definitions',
      'work_schedule_versions',
      'company_off_calendar_versions',
      'video_policy_versions',
      'video_policy_acknowledgements',
      'attendance_events',
      'checkin_video_assets',
      'video_review_results',
      'late_occurrences',
      'attendance_penalty_policy_versions',
      'attendance_violations',
      'penalty_settlements',
      'penalty_payment_transitions',
      'workflow_definition_versions',
      'approval_requests',
      'approval_run_steps',
      'approval_decision_records',
      'leave_conflict_snapshots',
      'monthly_absence_summaries',
      'attendance_job_runs',
      'media_retention_tombstones',
    ])
      expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it('keeps Module 2 upgrade path and adds composite tenant isolation constraints', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).not.toContain('DROP TABLE "daily_kpi_reports"');
    expect(sql).not.toContain('DROP TABLE "kpi_definitions"');
    for (const constraint of [
      'work_schedule_membership_fk',
      'work_schedule_branch_fk',
      'attendance_event_schedule_fk',
      'checkin_video_media_fk',
      'workflow_request_definition_fk',
      'approval_step_request_fk',
      'approval_decision_step_fk',
      'attendance_violation_policy_fk',
      'penalty_settlement_member_fk',
      'attendance_job_run_tenant_fk',
    ])
      expect(sql).toContain(constraint);
    expect(sql).toContain('FOREIGN KEY ("tenant_id", "membership_id")');
    expect(sql).toContain('FOREIGN KEY ("tenant_id", "branch_id")');
  });

  it('declares natural idempotency, active-version and scope validity safeguards', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const indexOrConstraint of [
      'work_schedule_active_unique_idx',
      'attendance_event_member_date_uniq',
      'video_policy_ack_member_policy_uniq',
      'attendance_violation_idempotency_uniq',
      'penalty_payment_actor_idempotency_uniq',
      'approval_decision_actor_step_uniq',
      'attendance_job_run_day_uniq',
      'attendance_job_run_month_uniq',
      'video_policy_scope_ck',
      'penalty_policy_amount_ck',
      'off_calendar_scope_ck',
      'payment_transition_status_ck',
    ])
      expect(sql).toContain(indexOrConstraint);
  });

  it('adds Prisma enums and models without weakening existing KPI models', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    for (const modelOrEnum of [
      'enum ShiftStatus',
      'enum ScheduleState',
      'enum AttendanceState',
      'enum VideoProcessingState',
      'enum ViolationKind',
      'enum RequestType',
      'enum ApprovalDecision',
      'model ShiftDefinition',
      'model WorkScheduleVersion',
      'model VideoPolicyVersion',
      'model AttendancePenaltyPolicyVersion',
      'model WorkflowDefinitionVersion',
      'model MediaRetentionTombstone',
    ])
      expect(schema).toContain(modelOrEnum);
    expect(schema).toContain('model DailyKpiReport');
    expect(schema).not.toContain('BLOCKED_DATA_ERROR');
  });
});
