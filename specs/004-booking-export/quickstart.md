# Quickstart Validation: Module 4 Booking và Export

## Prerequisites

- Node.js 24, Corepack/pnpm 10
- PostgreSQL reachable through `DATABASE_URL`
- Dependencies installed with `corepack pnpm install`
- Module 1-3 migrations applied
- No production AWS/chat credentials are required; local adapters/test doubles are supported

## Prepare

```powershell
corepack pnpm --filter @adsup/database prisma:generate
corepack pnpm --filter @adsup/database prisma:migrate:deploy
corepack pnpm --filter @adsup/database prisma:seed
```

Seed verification must confirm booking form version, cancellation reasons, report destinations,
retention policy, customers, services and representative scheduled/walk-in bookings.

## Automated Gates

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm contracts:validate
corepack pnpm test
corepack pnpm test:contract
corepack pnpm test:integration
corepack pnpm test:migration
corepack pnpm test:coverage
corepack pnpm load:smoke
corepack pnpm build
```

## Scenario 1: Conflict and concurrency

1. Create a scheduled booking at 09:00 for employee E in branch A.
2. Verify 09:59 is rejected and 10:00 is accepted.
3. Submit two concurrent conflicting creates and verify at most one commits.
4. Verify same time for a different employee succeeds.
5. Cancel the original booking and verify its old slot no longer blocks a new booking.

Expected: clear 409 conflict, no partial form submission/history, no cross-branch effects.

## Scenario 2: Arrival, consent, photo debt and tour

1. Record consent and ARRIVED without a READY photo.
2. Verify one photo debt and one action item are created.
3. Retry arrival and worker consumption; verify no duplicates.
4. Confirm media upload, then verify debt/action item close.
5. Complete tour and query Module 2 booking KPI source.

Expected: completion is blocked before READY photo, then succeeds once and emits one KPI event.

## Scenario 3: Outcome and reschedule

1. Publish/configure cancellation reasons.
2. Cancel one booking and reschedule another.
3. Verify source/replacement links, reason snapshots and append-only transitions.
4. Disable the reason and confirm history still displays the old label.

## Scenario 4: Scheduled reports

1. Use deterministic clock at tenant-local 20:08 and run tomorrow schedule report.
2. Run at 22:00 for current-day outcomes.
3. Retry both runs and simulate one chat failure.

Expected: correct business date/branch grouping, no duplicate successful message, failed destination
is observable and rerunnable.

## Scenario 5: XLSX export

1. Request a bounded multi-branch export within actor scope.
2. Wait for READY and download using a short-lived URL.
3. Open workbook and compare totals/rows with authoritative queries.
4. Include values beginning `=`, `+`, `-`, `@`, tab and carriage return.
5. Revoke one branch permission before download.

Expected: native XLSX opens successfully, formulas are neutralized, repeated request is idempotent
and revoked scope blocks download.

## Scenario 6: Privacy and retention

1. Expire one customer photo and one XLSX.
2. Put legal hold on another photo.
3. Run retention twice.

Expected: expired binaries are deleted once with tombstones, download is denied, held media remains,
and audit/metadata does not expose PII/object keys.

## Local Run

```powershell
corepack pnpm dev:api
corepack pnpm dev:worker
```

Health endpoints must be ready, scheduler metrics must expose safe counts/durations and logs must
contain no customer PII, signed URLs or storage credentials.

## Dependency Gate

Module 4 may open Module 5 only when all tasks are checked, gates above pass with recorded results,
OpenAPI/Zod/event contracts match implementation, no critical path is mock-only and
`$speckit-converge` reports no remaining Module 4 work.
