# Quickstart: Module 2 KPI hằng ngày

## Prerequisites

- Node.js 24, pnpm 10.28 and dependencies already installed.
- A local PostgreSQL URL in `DATABASE_URL`; Prisma Dev is acceptable.
- Test JWT/Google verifier and notification/realtime/media adapters from Module 1; no AWS/FCM/APNs keys.

## Local verification sequence

Run from repository root in PowerShell:

```powershell
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contract
pnpm test:integration
pnpm test:migration
pnpm test:coverage
pnpm contracts:validate
pnpm build
pnpm load:smoke
```

The implementation stage may call direct workspace binaries when Corepack permission is unavailable, but
the final module gate must prove the documented scripts work in the supported environment.

## Deterministic business scenario

1. Seed tenant `Công ty TNHH ABC`, its branches, users and three KPI definitions.
2. Create tenant policy effective today: timezone `Asia/Ho_Chi_Minh`, open `18:00:00`, close `20:00:00`,
   evaluation `20:00:01`, daily failure penalty `100000` VND.
3. Create revenue/count/on-time targets and mapping versions. Attendance uses a test source adapter until
   Module 3.
4. Freeze the test clock at 18:30 local and create a valid dynamic form submission, then a report revision.
5. Read progress/action items; verify target, actual, remaining, source freshness, deadline and deep-link.
6. Create a second revision before 20:00; verify the first remains and the current projection uses the
   second.
7. At exactly 20:00 submit another revision; verify it is recorded as late and cannot make the day pass.
8. Advance past evaluation time and run close-day twice plus concurrent claims. Verify exactly one
   evaluation and at most one 100.000 VND KPI penalty for the employee/day.
9. Change tomorrow's policy/target; verify the closed day still references the old versions.
10. Create an adjustment with reason; verify original penalty remains immutable and replay is idempotent.

## Single-branch safety case

Create two overlapping active branch assignments for one test employee and run evaluation. Expected:

- no guessed effective policy;
- no daily evaluation or penalty is assessed; the failure exists only on the job item/error record;
- job records a safe `MULTIPLE_ACTIVE_BRANCHES` item-level failure and continues;
- a manager-visible `DATA_QUALITY` action item is created;
- no branch/tenant data outside authorized scope is exposed.

## Evidence case

Enable evidence policy with 5-minute grace. Submit a report whose configured KPI evidence is missing:

- debt starts `WAITING_PHOTOS` with exact required/received/remaining counts;
- READY media with matching tenant/owner/source closes debt idempotently;
- wrong-tenant, wrong-owner, pending or deleted media never counts;
- overdue finalization and reminder replay 100 times create no duplicate transition/penalty;
- no perceptual-hash fraud decision occurs.

## Load profile

The load fixture creates 10.000 memberships without making this a business limit. Measure:

- progress and action-item reads p95 below 500 ms on the documented local profile;
- close-day processing uses bounded pages and advances checkpoints only after committed employee work;
- forced worker termination resumes from the last checkpoint;
- metrics have bounded labels and logs contain no raw form/revenue/member data.

Record exact machine/DB settings, dataset size, elapsed time and percentile output in the module
`verification.md`; do not claim production capacity solely from a developer laptop smoke test.
