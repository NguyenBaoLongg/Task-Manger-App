# Tasks: Booking và XLSX Export

**Input**: Design documents from `/specs/004-booking-export/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`, `checklists/requirements.md`, `checklists/booking-export-quality.md`

**Tests**: TDD is mandatory. Each buildable requirement has unit, contract, integration,
tenant-isolation/RBAC, migration, worker retry/concurrency, retention or load verification before
implementation is marked complete.

**Organization**: Tasks are grouped by user story and ordered by dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on an
  incomplete task in the same phase.
- **[Story]**: Maps to `US1` through `US6` in `spec.md`.
- Every task includes an exact file path.

## Phase 1: Setup

**Purpose**: Add Module 4 entry points and dependencies without implementing business behavior.

- [X] T001 Add ExcelJS as the native XLSX dependency and keep PDF libraries absent in `apps/worker/package.json`
- [X] T002 [P] Create booking contract schema entry point in `packages/contracts/src/booking.ts`
- [X] T003 Export booking contracts and OpenAPI loader from `packages/contracts/src/index.ts`
- [X] T004 [P] Create booking domain barrel in `packages/domain/src/bookings/index.ts`
- [X] T005 Export booking domain barrel from `packages/domain/src/index.ts`
- [X] T006 [P] Create booking API route entry point in `apps/api/src/modules/bookings/booking-routes.ts`
- [X] T007 [P] Create booking configuration route entry point in `apps/api/src/modules/bookings/booking-config-routes.ts`
- [X] T008 [P] Create export API route entry point in `apps/api/src/modules/bookings/export-routes.ts`
- [X] T009 [P] Create booking worker scheduler entry point in `apps/worker/src/bookings/scheduler.ts`
- [X] T010 Add optional Module 4 dependency slots and route mounting points in `apps/api/src/app.ts`

---

## Phase 2: Foundational

**Purpose**: Shared schema, permissions, contracts, repositories, adapters and fixtures required by
all user stories.

**Critical**: No user story implementation begins until this phase passes.

### Tests and Contracts

- [X] T011 [P] Add OpenAPI parse, internal-ref and policy metadata tests for `specs/004-booking-export/contracts/openapi.yaml` in `packages/contracts/src/booking-openapi.test.ts`
- [X] T012 [P] Add Zod/event compatibility tests for Module 4 request and outbox schemas in `packages/contracts/src/booking.test.ts`
- [X] T013 [P] Add clean-deploy and Module 3 upgrade migration tests in `tests/migration/booking-export.migration.test.ts`
- [X] T014 [P] Add migration assertions for composite tenant FKs, indexes and partial GiST conflict constraint in `tests/migration/booking-conflict-constraint.migration.test.ts`
- [X] T015 [P] Add deterministic seed rerun tests for booking form, reasons, destinations, retention, customers, services and bookings in `tests/migration/booking-seed.integration.test.ts`
- [X] T016 [P] Add published HTTP contract coverage for auth, RBAC metadata, problem details, idempotency and pagination in `apps/api/tests/contract/booking-published-http.contract.test.ts`

### Database, RBAC and Shared Infrastructure

- [X] T017 Add Module 4 enums and tenant-scoped models from `data-model.md` to `packages/database/prisma/schema.prisma`
- [X] T018 Create migration SQL including `btree_gist`, composite tenant FKs, indexes and exclusion constraint in `packages/database/prisma/migrations/202607240001_booking_export/migration.sql`
- [X] T019 Add booking/customer/config/report/export/legal-hold permissions and role grants in `packages/database/prisma/seed.ts`
- [X] T020 Add deterministic Module 4 fixture seed and verification helper in `packages/database/prisma/verify-booking-seed.ts`
- [X] T021 [P] Create tenant-scoped customer/booking repository skeleton in `packages/database/src/booking.repository.ts`
- [X] T022 [P] Create worker job/report/photo-debt repository skeleton in `packages/database/src/booking-worker.repository.ts`
- [X] T023 [P] Create export claim/checkpoint/file lifecycle repository skeleton in `packages/database/src/export.repository.ts`
- [X] T024 Export Module 4 repositories from `packages/database/src/index.ts`
- [X] T025 [P] Add deterministic booking clocks, storage/chat collectors and fixture builders in `packages/testing/src/booking.ts`
- [X] T026 [P] Add shared booking state, conflict, consent, report and export primitives in `packages/domain/src/bookings/types.ts`
- [X] T027 Add Module 4 repository/service wiring placeholders in `apps/api/src/index.ts`
- [X] T028 Add Module 4 scheduler/export runner wiring placeholders in `apps/worker/src/index.ts`

**Checkpoint**: Foundation and migration contracts pass.

---

## Phase 3: User Story 1 - Booking đúng cơ sở và không trùng nhân sự (Priority: P1) MVP

**Goal**: Authorized staff manage tenant/branch-scoped customers and scheduled bookings backed by
published dynamic forms, with race-safe 60-minute conflict enforcement.

**Independent Test**: Create a 09:00 booking, reject 09:59, accept 10:00, accept the same time for
another employee, and prove two concurrent conflicting requests commit at most one row.

### Tests for User Story 1

- [X] T029 [P] [US1] Add unit tests for 60-minute boundary, active statuses and walk-in exclusion in `packages/domain/src/bookings/conflict.test.ts`
- [X] T030 [P] [US1] Add contract tests for customer, effective service catalog and scheduled booking endpoints in `apps/api/tests/contract/booking-create.contract.test.ts`
- [X] T031 [P] [US1] Add customer tenant/branch isolation and optimistic update tests in `apps/api/tests/integration/booking-customer-isolation.integration.test.ts`
- [X] T032 [P] [US1] Add dynamic FormVersion validation and immutable submission tests in `apps/api/tests/integration/booking-form.integration.test.ts`
- [X] T033 [P] [US1] Add 59/60-minute and terminal-status booking integration tests in `apps/api/tests/integration/booking-conflict.integration.test.ts`
- [X] T034 [P] [US1] Add concurrent scheduled-booking create database race test in `apps/api/tests/integration/booking-conflict-concurrency.integration.test.ts`
- [X] T035 [P] [US1] Add cross-tenant customer/service/employee/form ID denial tests in `apps/api/tests/integration/booking-reference-isolation.integration.test.ts`

### Implementation for User Story 1

- [X] T036 [P] [US1] Implement pure active-status and 60-minute conflict rules in `packages/domain/src/bookings/conflict.ts`
- [X] T037 [P] [US1] Implement booking/customer/effective-service Zod schemas and stable cursor filters in `packages/contracts/src/booking.ts`
- [X] T038 [US1] Implement customer and customer-branch repository methods with tenant composite keys in `packages/database/src/booking.repository.ts`
- [X] T039 [US1] Implement effective versioned service availability, assignment, published form and conflict repository methods in `packages/database/src/booking.repository.ts`
- [X] T040 [US1] Implement atomic scheduled booking + FormSubmission + initial history + audit/outbox transaction in `packages/database/src/booking.repository.ts`
- [X] T041 [US1] Implement customer service with branch-scoped RBAC, idempotency, redaction and optimistic state version in `apps/api/src/modules/bookings/customer-service.ts`
- [X] T042 [US1] Implement scheduled booking service with authoritative time/scope and conflict mapping in `apps/api/src/modules/bookings/booking-service.ts`
- [X] T043 [US1] Implement customer list/get/create/update and effective service catalog endpoints in `apps/api/src/modules/bookings/booking-routes.ts`
- [X] T044 [US1] Implement booking list/get/create endpoints in `apps/api/src/modules/bookings/booking-routes.ts`
- [X] T045 [US1] Register US1 services/routes and metrics in `apps/api/src/app.ts` and `apps/api/src/observability/index.ts`

**Checkpoint**: US1 can be demonstrated without Module 4 worker jobs.

---

## Phase 4: User Story 2 - ARRIVED, consent, photo debt và công tour (Priority: P1)

**Goal**: Staff record consent/arrival, track missing customer photos and complete tours only with
authoritative READY media.

**Independent Test**: ARRIVED without photo creates one debt/action item, media completion closes
both idempotently, and tour completion is rejected before then and accepted exactly once afterward.

### Tests for User Story 2

- [X] T046 [P] [US2] Add unit tests for arrival, consent, photo-debt and tour state rules in `packages/domain/src/bookings/arrival.test.ts`
- [X] T047 [P] [US2] Add contract tests for consent, customer-photo upload intent, walk-in, arrival, photo debt and tour endpoints in `apps/api/tests/contract/booking-arrival.contract.test.ts`
- [X] T048 [P] [US2] Add integration tests proving consent precedes upload intent and READY media authorization in `apps/api/tests/integration/booking-consent-media.integration.test.ts`
- [X] T049 [P] [US2] Add arrival retry/concurrency tests proving one transition, debt and action item in `apps/api/tests/integration/booking-arrival-concurrency.integration.test.ts`
- [X] T050 [P] [US2] Add media-completion outbox retry and debt/action-item closure tests in `apps/worker/tests/integration/booking-photo-debt.integration.test.ts`
- [X] T051 [P] [US2] Add tour completion, correction and Module 2 source tests in `apps/api/tests/integration/booking-tour-kpi.integration.test.ts`
- [X] T052 [P] [US2] Add cross-tenant media/debt/tour denial and PII log-redaction tests in `apps/api/tests/integration/booking-media-isolation.integration.test.ts`

### Implementation for User Story 2

- [X] T053 [P] [US2] Implement pure arrival/debt/tour transitions in `packages/domain/src/bookings/arrival.ts`
- [X] T054 [US2] Add consent, customer-photo upload-intent, walk-in, arrival, debt and tour schemas/events in `packages/contracts/src/booking.ts`
- [X] T055 [US2] Implement atomic walk-in + consent + ARRIVED + debt/history transaction in `packages/database/src/booking.repository.ts`
- [X] T056 [US2] Implement scheduled arrival, consent, photo debt and tour repository methods in `packages/database/src/booking.repository.ts`
- [X] T057 [US2] Extend media purpose/source validation so customer-photo upload intents require same-scope consent in `apps/api/src/modules/media/media-service.ts`
- [X] T058 [US2] Implement consent, photo upload intent, arrival/walk-in/tour application service and action-item integration in `apps/api/src/modules/bookings/arrival-service.ts`
- [X] T059 [US2] Implement consent, photo upload intent, walk-in, arrival, photo-debt list and tour-completion routes in `apps/api/src/modules/bookings/booking-routes.ts`
- [X] T060 [US2] Implement media-ready debt/action-item consumer with event dedupe in `apps/worker/src/bookings/photo-debt-runner.ts`
- [X] T061 [US2] Implement authoritative completed-tour KPI source adapter in `apps/api/src/modules/bookings/booking-kpi-source-service.ts`
- [X] T062 [US2] Wire photo-debt runner and KPI source dependency in `apps/worker/src/index.ts` and `apps/api/src/index.ts`

**Checkpoint**: US2 independently proves arrival-to-tour lifecycle and KPI source.

---

## Phase 5: User Story 3 - Outcome, cancellation reasons và reschedule (Priority: P1)

**Goal**: Configure versioned reasons, record terminal outcomes, reschedule atomically and reconcile
missing status/tour action items.

**Independent Test**: Cancel with an effective reason, disable it without altering history,
reschedule to a race-safe replacement and create/close overdue action items exactly once.

### Tests for User Story 3

- [X] T063 [P] [US3] Add unit tests for booking state machine and reason effective-version resolution in `packages/domain/src/bookings/state-machine.test.ts`
- [X] T064 [P] [US3] Add contract tests for reason configuration, outcome and reschedule endpoints in `apps/api/tests/contract/booking-outcomes.contract.test.ts`
- [X] T065 [P] [US3] Add reason version/snapshot/history integration tests in `apps/api/tests/integration/booking-reasons.integration.test.ts`
- [X] T066 [P] [US3] Add outcome idempotency and concurrent state-version tests in `apps/api/tests/integration/booking-outcome-concurrency.integration.test.ts`
- [X] T067 [P] [US3] Add concurrent reschedule database race, source/replacement, conflict and rollback tests in `apps/api/tests/integration/booking-reschedule.integration.test.ts`
- [X] T068 [P] [US3] Add missing-status/tour action-item worker retry tests in `apps/worker/tests/integration/booking-action-items.integration.test.ts`
- [X] T069 [P] [US3] Add RBAC/isolation tests for config, outcome, correction and reschedule in `apps/api/tests/integration/booking-outcome-isolation.integration.test.ts`

### Implementation for User Story 3

- [X] T070 [P] [US3] Implement pure state machine and reason applicability rules in `packages/domain/src/bookings/state-machine.ts`
- [X] T071 [US3] Add cancellation reason, outcome, reschedule and correction schemas in `packages/contracts/src/booking.ts`
- [X] T072 [US3] Implement versioned cancellation reason repository methods in `packages/database/src/booking.repository.ts`
- [X] T073 [US3] Implement locked outcome/history/audit/outbox transaction in `packages/database/src/booking.repository.ts`
- [X] T074 [US3] Implement atomic source/replacement reschedule transaction in `packages/database/src/booking.repository.ts`
- [X] T075 [US3] Implement booking configuration service with tenant-owner RBAC and effective versions in `apps/api/src/modules/bookings/booking-config-service.ts`
- [X] T076 [US3] Implement outcome/reschedule/correction commands in `apps/api/src/modules/bookings/booking-service.ts`
- [X] T077 [US3] Implement reason configuration routes in `apps/api/src/modules/bookings/booking-config-routes.ts`
- [X] T078 [US3] Implement outcome and reschedule routes in `apps/api/src/modules/bookings/booking-routes.ts`
- [X] T079 [US3] Implement overdue missing-status/tour action-item reconciliation in `apps/worker/src/bookings/action-item-runner.ts`
- [X] T080 [US3] Wire configuration and action-item runner dependencies in `apps/api/src/index.ts` and `apps/worker/src/index.ts`

**Checkpoint**: All P1 booking operations are independently testable.

---

## Phase 6: User Story 4 - Báo cáo lịch khách 20:08 và 22:00 (Priority: P2)

**Goal**: Produce tenant-local, branch-scoped tomorrow schedule and current-day outcome reports with
retry-safe chat delivery.

**Independent Test**: Run both report types for two tenants/multiple branches, fail one destination,
retry/rerun and verify correct snapshots with no duplicate successful message.

### Tests for User Story 4

- [X] T081 [P] [US4] Add unit tests for timezone windows and report aggregation in `packages/domain/src/bookings/report.test.ts`
- [X] T082 [P] [US4] Add contract tests for report destination config and rerun endpoint in `apps/api/tests/contract/booking-reports.contract.test.ts`
- [X] T083 [P] [US4] Add destination tenant/branch/channel compatibility tests in `apps/api/tests/integration/booking-report-config.integration.test.ts`
- [X] T084 [P] [US4] Add 20:08/22:00 snapshot and grouping integration tests in `apps/worker/tests/integration/booking-reports.integration.test.ts`
- [X] T085 [P] [US4] Add multi-worker lease, heartbeat, failure and delivery dedupe tests in `apps/worker/tests/integration/booking-report-concurrency.integration.test.ts`
- [X] T086 [P] [US4] Add tenant timezone-change and rerun audit tests in `apps/worker/tests/integration/booking-report-timezone.integration.test.ts`

### Implementation for User Story 4

- [X] T087 [P] [US4] Implement pure report window and aggregation rules in `packages/domain/src/bookings/report.ts`
- [X] T088 [US4] Add destination/report-run/rerun schemas and events in `packages/contracts/src/booking.ts`
- [X] T089 [US4] Implement destination configuration and validation repository methods in `packages/database/src/booking.repository.ts`
- [X] T090 [US4] Implement leased job claim, snapshot and delivery dedupe methods in `packages/database/src/booking-worker.repository.ts`
- [X] T091 [US4] Implement report destination configuration/rerun service in `apps/api/src/modules/bookings/booking-report-service.ts`
- [X] T092 [US4] Implement report configuration and rerun routes in `apps/api/src/modules/bookings/booking-config-routes.ts`
- [X] T093 [US4] Implement tomorrow schedule and today outcome renderer in `apps/worker/src/bookings/report-runner.ts`
- [X] T094 [US4] Implement retry-safe internal chat delivery adapter/effect in `apps/worker/src/bookings/report-delivery.ts`
- [X] T095 [US4] Register tenant-local report scheduling, metrics and rerun claims in `apps/worker/src/bookings/scheduler.ts`

**Checkpoint**: Scheduled booking reports pass retry and isolation tests.

---

## Phase 7: User Story 5 - Native XLSX export (Priority: P2)

**Goal**: Authorized managers request bounded exports, worker streams accurate native XLSX and
downloads are re-authorized.

**Independent Test**: Export selected branches/data types, verify workbook rows/totals/formula
neutralization, retry without duplicate file and deny download after branch permission revocation.

### Tests for User Story 5

- [X] T096 [P] [US5] Add unit tests for export bounds, sheet names, columns and formula neutralization in `apps/worker/tests/unit/xlsx-export.test.ts`
- [X] T097 [P] [US5] Add contract tests for export create/list/get/download endpoints in `apps/api/tests/contract/booking-exports.contract.test.ts`
- [X] T098 [P] [US5] Add export create idempotency and all-or-nothing branch-scope tests in `apps/api/tests/integration/booking-export-request.integration.test.ts`
- [X] T099 [P] [US5] Add XLSX generation, checksum, row reconciliation and retry tests in `apps/worker/tests/integration/booking-export.integration.test.ts`
- [X] T100 [P] [US5] Add current-RBAC download reauthorization and expired-file denial tests in `apps/api/tests/integration/booking-export-download.integration.test.ts`
- [X] T101 [P] [US5] Add bounded-memory/keyset checkpoint recovery tests in `apps/worker/tests/integration/booking-export-scale.integration.test.ts`

### Implementation for User Story 5

- [X] T102 [P] [US5] Implement pure filter bounds and spreadsheet-cell neutralization in `packages/domain/src/bookings/export.ts`
- [X] T103 [US5] Add XLSX-only export request/state/download schemas and events in `packages/contracts/src/booking.ts`
- [X] T104 [US5] Implement export request/list/state/idempotency methods in `packages/database/src/export.repository.ts`
- [X] T105 [US5] Implement leased claim, keyset checkpoint and READY/FAILED lifecycle methods in `packages/database/src/export.repository.ts`
- [X] T106 [US5] Implement export request and current-scope authorization service in `apps/api/src/modules/bookings/export-service.ts`
- [X] T107 [US5] Implement export create/list/get/download routes in `apps/api/src/modules/bookings/export-routes.ts`
- [X] T108 [US5] Implement streaming XLSX workbook generator with stable sheets/columns in `apps/worker/src/exports/xlsx-writer.ts`
- [X] T109 [US5] Implement export runner with pagination, storage upload, checksum and retry cleanup in `apps/worker/src/exports/export-runner.ts`
- [X] T110 [US5] Wire export runner, storage adapter, metrics and API dependencies in `apps/worker/src/index.ts` and `apps/api/src/index.ts`

**Checkpoint**: XLSX is a real local artifact; PDF remains absent.

---

## Phase 8: User Story 6 - Cấu hình có phiên bản và retention (Priority: P2)

**Goal**: Tenant Owner versions booking configuration and retention; worker deletes expired binary
with legal hold/tombstone safeguards.

**Independent Test**: Activate a future retention policy, expire photo/XLSX, hold another media,
run retention twice and verify only eligible binaries delete once while history remains.

### Tests for User Story 6

- [X] T111 [P] [US6] Add unit tests for effective policy precedence, expiry and legal hold rules in `packages/domain/src/bookings/retention.test.ts`
- [X] T112 [P] [US6] Add contract tests for service configuration, consent policy, retention policy and legal-hold commands in `apps/api/tests/contract/booking-retention.contract.test.ts`
- [X] T113 [P] [US6] Add service/consent/retention policy version history and tenant-owner RBAC tests in `apps/api/tests/integration/booking-retention-policy.integration.test.ts`
- [X] T114 [P] [US6] Add customer-photo/XLSX deletion, tombstone, legal-hold and retry tests in `apps/worker/tests/integration/booking-retention.integration.test.ts`
- [X] T115 [P] [US6] Add no-restore/no-download and audit redaction tests in `apps/api/tests/integration/booking-retention-privacy.integration.test.ts`

### Implementation for User Story 6

- [X] T116 [P] [US6] Implement pure retention policy resolution and deletion eligibility in `packages/domain/src/bookings/retention.ts`
- [X] T117 [US6] Add versioned service, consent policy, retention policy and legal-hold schemas in `packages/contracts/src/booking.ts`
- [X] T118 [US6] Implement versioned service/branch availability, consent/retention policy and governance audit repository methods in `packages/database/src/booking.repository.ts`
- [X] T119 [US6] Implement tenant-owner service catalog, consent/retention policy and legal-hold configuration in `apps/api/src/modules/bookings/booking-config-service.ts`
- [X] T120 [US6] Implement service, consent policy, retention and legal-hold routes in `apps/api/src/modules/bookings/booking-config-routes.ts`
- [X] T121 [US6] Extend media retention repository for customer photo/XLSX tombstones in `packages/database/src/booking-worker.repository.ts`
- [X] T122 [US6] Implement retry-safe booking/export media retention runner in `apps/worker/src/bookings/retention-runner.ts`
- [X] T123 [US6] Seed and verify versioned booking form, consent policy, reasons, destinations and retention policy in `packages/database/prisma/seed.ts` and `packages/database/prisma/verify-booking-seed.ts`

**Checkpoint**: Configuration history and privacy lifecycle pass.

---

## Phase 9: Polish and Cross-Cutting Verification

- [X] T124 [P] Add complete OpenAPI-to-Zod and published-route drift assertions in `packages/contracts/src/booking-openapi.test.ts`
- [X] T125 [P] Add end-to-end Module 4 workflow from booking creation through XLSX/retention in `apps/worker/tests/integration/booking-module.integration.test.ts`
- [X] T126 [P] Add event/outbox consumer retry and cross-tenant poisoning tests in `apps/worker/tests/integration/booking-outbox.integration.test.ts`
- [X] T127 [P] Add PII, signed URL, object key and credential log scan in `tests/security/booking-log-redaction.test.ts`
- [X] T128 Add Module 4 smoke profile and wire it into the root runner in `tests/load/booking-smoke-runner.mjs` and `tests/load/smoke-runner.mjs`
- [X] T129 Add database indexes/query-plan and 20.000-booking aggregation assertions in `tests/load/booking-database-smoke.integration.test.ts`
- [X] T130 Run Prisma format/validate/generate and migration/seed verification; record results in `specs/004-booking-export/quickstart.md`
- [X] T131 Run format check and lint; record exact results in `specs/004-booking-export/quickstart.md`
- [X] T132 Run workspace typecheck and OpenAPI/contract tests; record exact results in `specs/004-booking-export/quickstart.md`
- [X] T133 Run unit tests and coverage; record counts/coverage in `specs/004-booking-export/quickstart.md`
- [X] T134 Run integration, tenant-isolation, RBAC, concurrency and worker retry tests; record results in `specs/004-booking-export/quickstart.md`
- [X] T135 Run migration, retention/privacy and load smoke gates; record results in `specs/004-booking-export/quickstart.md`
- [X] T136 Run API/worker/shared-package builds and verify no PDF dependency or mobile code entered Module 4 in `specs/004-booking-export/quickstart.md`
- [X] T137 Update Module 4 API, worker, backup/restore and local operation documentation in `README.md` and `docs/architecture/operations.md`
- [X] T138 Update Graphify after implementation and verify Module 4 paths with `.tools/graphify.ps1`
- [ ] T139 Run `$speckit-converge` against spec/plan/tasks/contracts/data-model/quickstart and append only genuine missing Module 4 work to `specs/004-booking-export/tasks.md`

---

## Dependencies and Execution Order

- Phase 1 → Phase 2 blocks all stories.
- US1 establishes Customer, ServiceOffering, Booking, FormSubmission link and conflict invariant.
- US2 depends on US1 Booking and Module 1 media/action items.
- US3 depends on US1 Booking; its reason configuration can proceed in parallel with early US2 work,
  but outcome/reschedule merge after booking repository foundations.
- US4 depends on US1-US3 authoritative statuses and report destinations.
- US5 depends on US1-US4 read models/contracts plus Module 1-3 KPI/penalty/action-item sources.
- US6 depends on US2 customer media and US5 export media.
- Phase 9 runs only after US1-US6 pass their checkpoints.

## Parallel Opportunities

- Foundational OpenAPI, migration, seed and published-contract tests can be authored in parallel
  before implementation.
- Within each story, unit, contract and integration test files marked `[P]` can be authored
  concurrently; implementation starts only after their intended failures are observed.
- Report renderer and destination service can proceed in parallel after shared report schemas.
- XLSX writer and export API service can proceed in parallel after export contracts/repository
  interfaces stabilize.
- Retention pure rules and contract tests can proceed while US5 completes, but deletion runner waits
  for both customer-photo and XLSX media lifecycles.

## Implementation Strategy

1. Complete setup/foundation and prove migration/contract failures first.
2. Deliver P1 stories in order: US1 booking, US2 arrival/tour, US3 outcomes/reschedule.
3. Deliver P2 automation: US4 reports, US5 XLSX, US6 retention/config.
4. Run all cross-cutting gates and converge; append tasks only for demonstrated gaps.
5. Open Module 5 only when every Module 4 task is `[X]`, verification is recorded and converge finds
   no missing work.

---

## Phase 10: User Story 2 convergence remediation

**Goal**: Close the remaining US2 consent/media authorization, auditability, event-contract and
PostgreSQL concurrency gaps without changing the scope of User Story 2.

**Dependencies**: T140-T141 can proceed in parallel. T142-T144 depend on the relevant schema and
authorization changes. T145 depends on T140 and T144. These tasks remain before the US2 dependency
gate is closed; they do not start User Stories 3-6 or mobile work.

- [X] T140 [US2] Persist an immutable consent-to-media authorization link for `CUSTOMER_BOOKING_PHOTO` in the Prisma schema and migration, propagate it through upload-intent creation and media-ready processing, and enforce the same tenant/branch/booking consent at ARRIVED and tour completion; add repository/service/integration coverage.
- [X] T141 [P] [US2] Harden the generic media upload-intent route so `CUSTOMER_BOOKING_PHOTO` requires `booking.arrival.manage`, validates the booking branch and tenant before issuing an intent, and cannot bypass the booking-specific authorization path; add OpenAPI/contract, RBAC and cross-tenant tests.
- [X] T142 [US2] Extend `CustomerPhotoDebt` persistence and resolution writes with the actor/time/reason metadata required by the data model for resolved or waived states, preserve append-only audit history, and add worker/API audit assertions without expanding waiver workflow scope.
- [X] T143 [P] [US2] Add direct contract tests for `booking.arrived.v1`, `booking.customer-photo-ready.v1`, `booking.photo-debt-changed.v1` and `booking.tour-completed.v1`, covering envelope validation, tenant/branch scope, stable identifiers and tenant-plus-event dedupe behavior.
- [X] T144 [US2] Add a live PostgreSQL concurrency integration test for two simultaneous tour-completion requests, proving at most one active `TourCompletion`, one photo-debt/action-item closure and one committed outbox event under retry/concurrency.
- [X] T145 [US2] Make a duplicate tour-completion request with a different payload or idempotency key return a deterministic conflict instead of silently returning the prior completion; add API contract and integration tests while preserving same-request idempotent replay.

---

## Phase 11: User Story 2 convergence remediation

- [X] T146 [US2] Align emitted `booking.customer-photo-ready.v1` payloads with `contracts/domain-events.md` and `bookingCustomerPhotoReadyEventSchema`, suppress the event for customer-photo media without a persisted consent binding, and add a live outbox-payload contract assertion per FR-041/FR-049 (partial).

---

## Phase 12: User Story 3 convergence remediation

- [X] T147 [US3] Add a live regression test and update versioned cancellation/reason configuration so creating a new reason version closes the previous version at the new `effectiveFrom`, and an inactive or superseded reason version cannot be selected for a later outcome/reschedule; preserve historical snapshots and tenant scope per FR-020, FR-021 and US3/AC2 (partial).

---

## Phase 13: User Story 4 convergence remediation

- [X] T148 [US4] [HIGH] Pass the actual rendered snapshot content hash and delivered destination count into `completeReportRun`, emit those values in `booking.report-ready.v1`, and add a live outbox contract test per FR-027 and `contracts/domain-events.md` (partial).
- [X] T149 [US4] [MEDIUM] Add observable heartbeat lease-extension coverage and a partial-delivery retry test proving already-succeeded destinations are skipped while failed destinations retry without duplicate chat messages per T085/FR-028 (partial).
- [X] T150 [US4] [MEDIUM] Add a live PostgreSQL negative test proving a report destination cannot reference a chat channel from another tenant, while preserving branch-compatible channel validation per FR-026 and Constitution I (partial).

---

## Phase 14: User Story 4 contract remediation

**Goal**: Make the persisted `booking.report-ready.v1` outbox record conform to the
authoritative booking event envelope, and make the live contract test assert the stored value
instead of substituting it.

**Dependencies**: T151 depends on T148 and remains within the User Story 4 dependency gate.

- [X] T151 [US4] [MEDIUM] Change the `booking.report-ready.v1` outbox aggregate type to the
  `BOOKING` value required by `bookingEventEnvelopeSchema` and `contracts/domain-events.md`, then
  update the live PostgreSQL outbox contract test to build the envelope from the stored
  `aggregateType` and assert it directly; preserve tenant scope and the existing report-run
  dedupe key.

---

## Phase 15: User Story 5 convergence remediation

**Goal**: Close the remaining XLSX metadata, multi-source pagination, retry scheduling,
row-reconciliation and local artifact delivery gaps without starting User Story 6 or mobile work.

- [X] T152 [US5] [HIGH] Extend the streaming XLSX writer and export runner with a stable metadata/manifest sheet containing selected filters, generated-at and tenant timezone, plus deterministic sheets and columns for each selected data type per FR-031 (partial).
- [X] T153 [US5] [HIGH] Replace the shared cross-table export cursor with per-source cursors or a canonical tenant-scoped union ordering so multi-data-type exports cannot skip rows; add PostgreSQL integration coverage for interleaved source IDs per FR-031 and FR-043 (partial).
- [X] T154 [US5] [HIGH] Add retry scheduling with persisted next-attempt/backoff state, bounded attempts and deterministic transition to `FAILED`; update runnable selection, worker behavior and retry/final-failure tests per FR-033 (partial).
- [X] T155 [US5] [MEDIUM] Add exact source-row manifest and XLSX row-reconciliation verification across every selected data type, including zero-row and multi-source exports, per the US5 independent test (partial).
- [X] T156 [US5] [HIGH] Wire API and worker local/object storage through the same artifact adapter and add a live end-to-end test proving a READY worker-generated XLSX can be downloaded only while current tenant/branch authorization and expiry allow it per FR-030 and FR-035 (partial).

## Phase 16: User Story 6 convergence

- [X] T157 [US6] [HIGH] Wire the booking/export retention worker through the configured object-storage adapter, selecting S3-compatible deletion when `OBJECT_STORAGE_DRIVER=s3` and a local adapter only for local/test runs; preserve tenant-scoped keys, retry/idempotency and add an adapter contract test per the plan storage decision, FR-036/FR-038, Constitution IV and Constitution VI (partial).
