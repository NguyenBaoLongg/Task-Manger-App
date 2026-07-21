# Verification Evidence: Module 1

**Feature**: `001-multitenant-foundation`  
**Verified**: 2026-07-19  
**Environment**: Windows, Node.js 24.12.0, pnpm 10.28.0, Prisma 7.8.0,
Prisma Dev PostgreSQL (TCP `localhost:51214`)

## Static quality gates

| Gate | Command/equivalent | Result |
|---|---|---|
| Format | `prettier --check .` | PASS |
| Lint | `eslint . --max-warnings=0` | PASS, zero warnings |
| Typecheck/build | `tsc -b --pretty false --force` | PASS for 8 workspace projects |
| Prisma schema | `prisma validate --config prisma.config.ts` | PASS |
| OpenAPI | YAML parse + executable HTTP/operation/schema tests | PASS, 36 paths / 47 unique operation IDs |
| Secret scan | repository regex scan excluding generated/vendor/cache files | PASS |

`tsc -b` emits every package and both deployable apps, so it is both the TypeScript typecheck and
build gate. Package scripts expose the same operations through `pnpm typecheck` and `pnpm build`.

## Automated tests

| Suite | Result |
|---|---|
| Unit/foundation | 9 files, 13 tests PASS |
| HTTP/OpenAPI contract | 9 files, 15 tests PASS |
| Integration/security/realtime | 8 files, 21 tests PASS |
| Migration shape/seed determinism | 1 file, 4 tests PASS |
| Entire suite with live PostgreSQL + V8 coverage | 25 files, 50 tests PASS |
| PostgreSQL convergence suites | 2 files, 13 tests PASS |
| Coverage snapshot | statements 63.69%, branches 47.46%, functions 64.38%, lines 65.72% |

The coverage snapshot is recorded for trend tracking. Module 1 has no numeric coverage threshold;
its mandatory risk gates are contract behavior, tenant isolation, idempotency, migration and seed.

## Database and seed

Migrations `202607190001_foundation`, `202607190002_convergence`,
`202607190003_extensible_media_purpose` and
`202607190004_existing_member_invitations` and `202607190005_required_audit_reasons` applied
successfully. The convergence migrations add
encrypted idempotency response storage, raise the governed media bound to 500 MiB, make media
purpose extensible and allow an existing membership to accept different valid invitations.
`prisma migrate status` reports the database schema up to date. The seed was
rerun after acceptance cleanup, followed by a live count check:

```text
SEED_COUNTS_OK {
  "tenant":1,
  "memberships":30,
  "branches":3,
  "departments":4,
  "positions":3,
  "roles":3,
  "assignments":29,
  "bindings":30,
  "generalChannels":1
}
```

The tenant is exactly `Công ty TNHH ABC`. The 29 assignments are for employees 2–30; the owner
membership is deliberately not assigned to a branch in Module 1.

## Live API acceptance

The API ran against the migrated local PostgreSQL instance with fake Google, memory object storage,
noop push and in-memory realtime adapters.

1. Readiness returned `status=ok`.
2. Google fake login created/loaded a stable identity.
3. Profile confirmation stored the user-provided full name.
4. Repeating tenant creation with the same idempotency key and body returned the same tenant ID.
5. Reusing that key with a different body returned `409`.
6. User A attempted User B's tenant detail, branches, departments, positions, memberships, roles,
   form templates, channels and audit events: all 9 routes returned safe `404` responses.

```text
API_ACCEPTANCE_OK tenantReplay=5b175093-d617-4707-9bb8-ed176d805195 crossTenant=404 ready=ok
TENANT_ISOLATION_MATRIX_OK routes=9 statuses=404,404,404,404,404,404,404,404,404 idempotencyConflict=409
API_E2E_OK ready=ok profileComplete=true idempotentTemplate=true formVersion=1
  mediaPurpose=DOCUMENT_EVIDENCE mediaByteSize=12 notificationStatus=ACTIVE auditCount=1
```

The convergence HTTP pass exercised encrypted replay, exact form-version submission, chat author
snapshot presentation, extensible PDF media intent, self-owned notification registration,
membership pagination and filtered audit retrieval. A real runtime defect that leaked the internal
`payload` property into Prisma submission data was found, fixed and rerun successfully. The two
acceptance tenants/users were then removed by their verified UUIDs; the database was reseeded and
returned to exactly one sample tenant and 30 users/memberships.

## Convergence remediation evidence

- Every one of the 30 OpenAPI-required mutation operations enforces an 8–128 character
  `Idempotency-Key`, a canonical request fingerprint and safe `409` conflict behavior. Full replay
  responses are AES-256-GCM encrypted; inspectable JSON is redacted, including tokens and URLs.
- Google invitation acceptance uses only the confirmed account full name. Expired, revoked,
  exhausted or unknown invitations return a safe `410`; invitation tokens and hashes never appear
  in list responses or audit payloads.
- Membership state changes and the last-owner invariant share one serializable transaction. The
  live PostgreSQL race test suspended two owners concurrently and proved exactly one remained
  active. Cross-tenant nested branch identifiers failed at the composite-FK boundary.
- Form template creation creates DRAFT v1. Publication immutably promotes the draft and creates the
  next draft; a submission must name an exact PUBLISHED version belonging to the same template.
- Memberships, channel messages and audit events use opaque stable cursors; audit supports
  `targetId`. Message/body bounds and notification response statuses match the 47-operation OpenAPI
  contract gate.
- Media verifies tenant source ownership or scoped permission, owner/scope access on completion and
  download, server-side checksum/type/size and atomic audited state transitions. Provider failure
  does not mark media READY, and failed idempotent operations are immediately retryable.
- Security/login, invitation, membership/RBAC, assignment, form publication and media transition
  events are recorded with correlation IDs and redacted before/after data; critical changes write
  business state and audit history in the same transaction.

## Realtime, media and load evidence

- Socket room keys are server-derived from tenant + channel; revoked/inactive membership is checked
  on every reconnect/join. Integration tests prove tenant room separation.
- S3 adapter tests create SigV4 PUT/GET URLs without live AWS credentials. Memory adapter tests prove
  checksum/size/type completion and retry-safe READY behavior.
- Redis Streams and in-memory backplanes share the realtime boundary; local acceptance uses memory.
- `node tests/load/smoke-runner.mjs` returned `LOAD_SMOKE_SCRIPT_OK`. The checked k6 profile contains
  failure and p95 latency thresholds. The full 200 requests/second + 2,000 connections profile must
  run in a sized staging environment before production, as specified in the plan.

## Quickstart deviations and resolutions

- Corepack attempted to write outside the sandbox. Dependencies were installed with the bundled
  pnpm runtime and `.npmrc` pins its store to `.cache/pnpm-store` inside this workspace.
- This machine has no Docker or system PostgreSQL. `prisma dev --detach` supplied the isolated local
  database; migration/seed used its direct PostgreSQL TCP URL for `@prisma/adapter-pg`.
- No live AWS, Redis, FCM, APNs or Google production credentials were used. Production adapters were
  verified through contracts/test doubles, preserving their production interfaces.
- A k6 executable is not installed locally. The smoke runner validates the versioned k6 profile;
  full capacity evidence remains a production-readiness activity, not a Module 2 dependency.

## Phase 10 convergence evidence

- Organization units and tenants now have audited non-destructive lifecycle transitions. Assignment
  queries support an effective timestamp or full history, and inactive or cross-tenant units are
  rejected before assignment or scoped role creation.
- Custom roles accept and return published `permissionCodes`; unknown permission codes fail with a
  stable validation problem. Channel creation atomically persists the creator as moderator and all
  requested active members, while Socket.IO inputs are schema validated.
- Profile confirmation, refresh and logout use encrypted account-scoped idempotency. Refresh replay
  returns the original encrypted response before replay security is evaluated; reuse with another key
  still revokes the token family.
- Published form versions can be retired and templates archived without deleting history. Lifecycle
  audits include mandatory reasons and redacted before/after state.
- Different invitations can be accepted concurrently by an existing member. Notification selection
  returns active endpoints only and records last use. Request status/duration, authentication and
  authorization denials, idempotency replays, realtime connections and adapter failures have
  non-sensitive counters.
- Executable HTTP conformance invokes all 47 published operations through Express and requires a
  declared success status; all 43 bearer-protected operations are also verified as mounted and
  authentication-protected. Validation, authorization, conflict/idempotency and safe 500 behavior
  have dedicated runtime assertions.
- The seed was executed three consecutive times after migration 004; the live regression then
  reconfirmed exactly 30 sample memberships, 3 branches, 4 departments, 3 positions, 3 roles,
  29 assignments, 30 bindings and one general channel.
- Migration 005 backfills historical null audit reasons and makes the column non-null. The domain
  audit port and every direct writer now require a reason, and the live regression confirms every
  generated event has a non-empty value.

The final `speckit-converge` pass found no remaining implementation work: 106/106 tasks are checked,
both checklists have zero open items, all 26 FRs and 8 SCs remain represented by the approved
spec/plan/tasks, and the 47-operation runtime contract plus live PostgreSQL gates pass. Module 1 is
therefore converged and may hand its stable schemas/contracts to Module 2.
