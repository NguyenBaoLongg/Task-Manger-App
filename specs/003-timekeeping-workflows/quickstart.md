# Quickstart: Chấm công và workflow duyệt

This guide defines validation scenarios for Module 3 after implementation. It intentionally avoids service
or controller code; detailed task breakdown belongs in `tasks.md`.

## Prerequisites

- Module 1 and Module 2 gates remain passing.
- Local PostgreSQL is available through the existing Prisma Dev workflow.
- No live AWS, FCM or APNs credentials are required; use configured test doubles/adapters.
- Current feature artifacts:
  - [spec.md](./spec.md)
  - [plan.md](./plan.md)
  - [data-model.md](./data-model.md)
  - [contracts/openapi.yaml](./contracts/openapi.yaml)

## Setup

```powershell
corepack pnpm install
corepack pnpm approve-builds
corepack pnpm --filter @adsup/database prisma:generate
```

For live database verification, start the existing project-local Prisma dev database and apply migrations:

```powershell
npm run db:dev
npm run db:migrate:deploy
npm run db:seed
```

## Scenario 1: Schedule versioning and 24-hour change rule

1. Seed tenant `Công ty TNHH ABC` with shifts 08:30 and 09:30.
2. Register a schedule for an employee more than 24 hours before the shift.
3. Self-edit the shift before the 24-hour cutoff.
4. Attempt self-edit inside 24 hours and verify a workflow request is required.
5. Manager adjusts after shift start with reason.

Expected:

- Schedule history keeps every version.
- Check-in snapshot continues to reference the schedule version active at check-in time.
- Cross-tenant branch/shift IDs fail safely.

## Scenario 2: Video policy acknowledgement and check-in

1. Attempt check-in before acknowledging current video policy.
2. Acknowledge policy and check in with a governed media object.
3. Simulate conversion retry and final READY state.
4. Manually review video as `FAILED`.

Expected:

- Pre-acknowledgement check-in is blocked.
- API accepts check-in without waiting for conversion.
- Worker retry does not create duplicate media/violations.
- Manual failed review creates `VIDEO_STANDARD_FAILED`; no AI decision exists.

## Scenario 2A: 15-minute pre-shift check-in reminder

Use deterministic test clock for shift 08:30:

1. Schedule three employees for the 08:30 shift in the same branch.
2. Record check-in for one employee before 08:15.
3. Mark one employee as `OFF` or approved leave.
4. Run the reminder worker at 08:15 tenant-local time.

Expected:

- Bot reminder is produced once for the branch/shift/business date.
- Reminder tags only the remaining scheduled employee who has not checked in.
- Retry with the same tenant, branch, date, shift and 15-minute lead time does not create a duplicate reminder.

## Scenario 2B: Final check-in warning before noon

Use deterministic test clock for the 12:00 missing-check-in cutoff:

1. Schedule three employees for morning shifts in the same branch.
2. Record check-in for one employee before 11:00.
3. Mark one employee as `OFF` or approved leave.
4. Run the reminder worker at 11:00 tenant-local time.
5. Run attendance close at 12:00 tenant-local time with the remaining employee still missing check-in.

Expected:

- Bot final warning is produced once for the branch/shift/business date/cutoff.
- Final warning tags only the remaining scheduled employee who has not checked in.
- Retry with the same tenant, branch, date, shift, cutoff and 60-minute lead time does not create a duplicate reminder.
- At 12:00, the remaining employee defaults to non-worked for report requirement and receives the missing-check-in
  penalty unless a valid OFF/leave/correction path exists.

## Scenario 3: Late calculation and reporting eligibility

Use deterministic test clock for shift 08:30:

- 08:30:59 => 0 late minutes, no late occurrence.
- 08:45:59 => 15 late minutes.
- 08:46:00 => 16 late minutes.
- After 15:00 => worked late and KPI report is still required.
- No check-in by 12:00 tenant-local time => missing-check-in penalty is created; later check-in/correction can prove
  worked status and calculate lateness but does not automatically remove the pre-noon violation.

Expected:

- Late minutes and seconds are stored.
- First late in month exempts base late penalty only.
- Second late applies: 1-15 fixed 20.000 VND; 16-89 uses 2.000 VND times minutes over 15; 90+ fixed
  200.000 VND.

## Scenario 4: OFF calendar

1. Manager creates tenant-wide OFF day for a holiday.
2. Manager creates branch-specific OFF day for one clinic.
3. Run day close workers for affected and unaffected branches.

Expected:

- OFF day creates no missing check-in, late or report-required penalty.
- OFF day does not count toward employee monthly absence threshold.
- Branch-specific OFF does not affect other branches.
- OFF calendar changes are versioned and audited.

## Scenario 5: Approval workflow races

1. Configure one-level, sequential two-level and parallel workflow definitions.
2. Submit shift change, late notice and leave requests.
3. Submit simultaneous approver decisions.

Expected:

- Only authorized approvers in tenant/branch scope can decide.
- Sequential steps activate one at a time.
- Parallel completion follows snapshotted required count/reject rule.
- Final effects apply once despite 100 retries/concurrent decisions.

## Scenario 6: Leave conflicts and monthly absence threshold

1. Submit approved leave for one employee.
2. Submit overlapping leave for another employee in same branch and department/position.
3. Submit overlapping leave in another branch.
4. Approve a mix of full-day, morning half-day and date-range leaves until total exceeds 5 days/month.

Expected:

- Same branch + same department/position conflict is blocked at submission and approval.
- Different branch can approve same day.
- Morning half-day counts 0.5; range expands per applicable day.
- Over 5 days/month emits one manager reminder and marks employee over threshold.

## Scenario 7: Penalty settlement and payment

1. Create same-day manual video failure and late occurrence with no notice.
2. Settle penalties.
3. Submit proof of payment and have manager confirm/reject/waive/refund.

Expected:

- Settlement charges max(video penalty, final late base penalty) plus independent no-notice amount.
- Suppressed component and reason are explainable.
- Payment transitions are idempotent and append-only.
- No payroll or payment gateway is invoked.

## Scenario 8: KPI attendance source

1. Confirm attendance for on-time, late, OFF/approved leave and missing-source days.
2. Query Module 2 source adapter `ATTENDANCE_ON_TIME_RATE`.

Expected:

- On-time returns `100`, late returns `0`.
- OFF/approved leave and non-worked/no-check-in return `null` for non-report-eligible days.
- Snapshot contains no video URL, raw evidence or sensitive metadata.

## Required gates before Module 3 can close

```powershell
corepack pnpm db:generate
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:contract
corepack pnpm test:integration
corepack pnpm test:migration
corepack pnpm test:coverage
corepack pnpm contracts:validate
corepack pnpm build
corepack pnpm load:smoke
```

Additional Module 3-specific evidence:

- Worker retry/concurrency suites for video conversion, day close, approvals and monthly absence summary.
- Migration clean deploy and Module 2 upgrade path.
- Deterministic seed rerun count including shifts, policies, workflows and OFF calendar examples.
- Load smoke for 10.000 check-in/day profile and p95 attendance/action-item reads.

## Implementation validation notes (2026-07-24)

All credential-free Module 3 gates were rerun from the repository root with Node 24 and project-local
`corepack pnpm`.

Commands and evidence:

- Prisma generation: `corepack pnpm db:generate` => Prisma Client 7.8.0 generated successfully.
- Format: `corepack pnpm format:check` => all matched files pass Prettier.
- Lint: `corepack pnpm lint` => pass with zero warnings.
- Typecheck: `corepack pnpm -r typecheck` => pass for config, contracts, domain, database, testing, API and worker.
- Unit: `corepack pnpm test` => 43 files and 122 tests pass.
- Contract: `corepack pnpm test:contract` => 19 files and 75 tests pass.
- OpenAPI: `corepack pnpm contracts:validate` => 1 file and 2 tests pass.
- Integration/worker: `corepack pnpm test:integration` => 19 files and 31 tests pass.
  Fifteen PostgreSQL-backed files containing 34 tests are skipped because `DATABASE_URL` is not set;
  the corresponding credential-free Module 3 behaviors run in deterministic repository harnesses.
- Migration: `corepack pnpm test:migration` => 4 files and 13 tests pass. One live seed file containing
  3 tests is skipped because `DATABASE_URL` is not set; schema and migration ordering checks pass.
- Coverage: `corepack pnpm test:coverage` => 85 files and 241 tests pass; 16 live-database files and
  37 tests are skipped. Overall coverage is 51.26% statements, 38.22% branches, 45.42% functions and
  51.61% lines.
- Build: `corepack pnpm build` => pass for every buildable workspace.
- Load smoke: `corepack pnpm load:smoke` => 10,000 check-ins accepted and 10,000 videos converted
  through 100 API batches and 50 worker batches; 30,000 tenant-scoped reads record p95 0.001 ms
  against the documented p95 target below 500 ms.

Scenario evidence:

- Scenario 1 schedule versioning: covered by schedule service/contract tests and live PostgreSQL history/isolation suites.
- Scenario 2 video policy/check-in: deterministic integration verifies acknowledgement plus persisted policy,
  schedule and media snapshots; worker tests cover conversion claim/retry.
- Scenario 3 late calculation/reporting eligibility: domain boundaries, tenant-local monthly allocation and
  concurrent late sequence tests pass.
- Scenario 4 OFF calendar: absence/day-close tests cover tenant and branch suppression, versioning and audit paths.
- Scenario 5 approval workflow races: routing harness and repository concurrency test verify 100 concurrent
  decisions, one decision record and one final effect.
- Scenario 6 leave conflicts/monthly threshold: deterministic integration covers every active assignment,
  cross-month ranges, half-days and manager threshold notification.
- Scenario 7 penalty settlement/payment: employee-self and scoped-manager tests cover ownership, state transitions,
  idempotency, audit and redacted outbox persistence.
- Scenario 8 KPI attendance source: attendance KPI source and privacy integration verify `100`, `0` and `null`
  semantics without media URLs or sensitive metadata.

The local dependency gate is met. Before production deployment, run `corepack pnpm db:migrate:deploy`,
`corepack pnpm db:seed` and the skipped PostgreSQL suites against the target database.
