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

## Scenario 3: Late calculation and reporting eligibility

Use deterministic test clock for shift 08:30:

- 08:30:59 => 0 late minutes, no late occurrence.
- 08:45:59 => 15 late minutes.
- 08:46:00 => 16 late minutes.
- After 15:00 => worked late and KPI report is still required.
- No check-in after 18:00 => non-worked for KPI report, but attendance/absence policy still applies.

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
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:contract
npm run test:integration
npm run test:migration
npm run test:coverage
npm run build
```

Additional Module 3-specific evidence:

- Worker retry/concurrency suites for video conversion, day close, approvals and monthly absence summary.
- Migration clean deploy and Module 2 upgrade path.
- Deterministic seed rerun count including shifts, policies, workflows and OFF calendar examples.
- Load smoke for 10.000 check-in/day profile and p95 attendance/action-item reads.

## Implementation validation notes (2026-07-21)

`npm run ...` could not be used in this local shell because the global `npm-cli.js` path is missing. Equivalent
project-local commands were run through `corepack pnpm`, `node_modules/.bin/*.cmd` and `node`.

Commands and evidence:

- Format: `.\node_modules\.bin\prettier.cmd --check .` => pass.
- Lint: `.\node_modules\.bin\eslint.cmd . --max-warnings=0` => pass.
- Typecheck: `corepack pnpm -r --if-present typecheck` => pass for config, contracts, domain, database, testing, API and worker.
- Unit: `.\node_modules\.bin\vitest.cmd run --exclude "**/*.integration.test.ts" --exclude "**/*.contract.test.ts" --exclude "tests/migration/**"` => 32 files, 82 tests pass.
- Contract: `.\node_modules\.bin\vitest.cmd run apps/api/tests/contract` => 19 files, 74 tests pass.
- Integration/worker: `.\node_modules\.bin\vitest.cmd run apps/api/tests/integration apps/worker/tests/integration` => 9 files and 14 tests pass; 24 live DB suites and 43 tests skipped because `DATABASE_URL` is not set.
- Migration: `.\node_modules\.bin\vitest.cmd run tests/migration` => 4 files and 13 tests pass; 1 live DB seed suite and 3 tests skipped because `DATABASE_URL` is not set.
- Coverage: `.\node_modules\.bin\vitest.cmd run --coverage` => 64 files and 183 tests pass; 25 files and 46 tests skipped.
- Build: `corepack pnpm -r --if-present build` => pass for all buildable workspaces.
- Load smoke: `node tests/load/smoke-runner.mjs` => `LOAD_SMOKE_SCRIPT_OK`, `KPI_LOAD_SMOKE_OK`, `TIMEKEEPING_LOAD_SMOKE_OK`.

Scenario evidence:

- Scenario 1 schedule versioning: pass via `attendance/schedule` unit, schedule contract, schedule integration shell and tenant isolation tests.
- Scenario 2 video policy/check-in: pass via check-in contract, video conversion unit and check-in integration shell.
- Scenario 3 late calculation/reporting eligibility: pass via `attendance/time` and `attendance/late-penalty` unit tests.
- Scenario 4 OFF calendar: pass via absence unit, leave contract, OFF calendar integration shell and day-close suppression implementation.
- Scenario 5 approval workflow races: pass via workflow state-machine unit, workflow contract, workflow concurrency/isolation integration shells.
- Scenario 6 leave conflicts/monthly threshold: pass via absence unit, leave contract, leave conflict shell and monthly absence runner test.
- Scenario 7 penalty settlement/payment: pass via penalty settlement unit and penalty contract; full DB audit/payment integration shell skipped without `DATABASE_URL`.
- Scenario 8 KPI attendance source: pass via attendance KPI source unit and privacy integration shell.
