---
description: "Dependency-ordered implementation tasks for Adsup Module 2"
---

# Tasks: KPI hằng ngày và việc cần hoàn thành

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Mandatory under Adsup Constitution. Test tasks precede the implementation they cover.

**Organization**: Existing Module 1 stays stable. Module 2 setup/foundation comes first, then one phase per
independently testable story in the order US1 → US2 → US3 → US4 → US5.

## Phase 1: Setup and contract baseline

**Purpose**: Register Module 2 shared contracts and source boundaries without changing product behavior.

- [x] T001 Copy and expose the reviewed Module 2 OpenAPI artifact from `specs/002-okr-kpi-engine/contracts/openapi.yaml` through `packages/contracts/src/index.ts`
- [x] T002 [P] Add KPI request/response Zod schemas and exact-value serializers in `packages/contracts/src/kpi.ts`
- [x] T003 [P] Add KPI/source/action-item domain types and error codes in `packages/domain/src/kpi/types.ts`
- [x] T004 [P] Add clock, source, realtime-effect and notification-effect ports in `packages/domain/src/kpi/ports.ts`
- [x] T005 Export Module 2 contracts/domain modules from `packages/contracts/src/index.ts` and `packages/domain/src/index.ts`
- [x] T006 Register KPI/action-item route composition points in `apps/api/src/app.ts` behind existing auth/correlation/problem middleware
- [x] T007 Register close-day, photo-debt and outbox worker composition points in `apps/worker/src/index.ts` without starting unmanaged timers in tests

**Checkpoint**: Existing Module 1 typecheck/tests pass and Module 2 contracts import without circular dependencies.

---

## Phase 2: Foundational data and domain rules (blocking)

**Purpose**: Establish schema, migration, seed, exact arithmetic, time/policy resolution, audit/outbox and job primitives shared by every story.

**CRITICAL**: No user-story implementation starts before this phase passes.

### Foundational tests first

- [x] T008 [P] Add money/count/percentage comparison and remaining-value unit tests in `packages/domain/src/kpi/calculation.test.ts`
- [x] T009 [P] Add report-window boundary, timezone snapshot and policy precedence unit tests in `packages/domain/src/kpi/policy.test.ts`
- [x] T010 [P] Add single-current-branch success/missing/multiple fail-safe unit tests in `packages/domain/src/kpi/assignment.test.ts`
- [x] T011 Add Module 2 schema, composite tenant key, check constraint and Module 1 upgrade tests in `tests/migration/kpi.migration.test.ts`
- [x] T012 Add deterministic three-run KPI seed assertions in `tests/migration/kpi-seed.integration.test.ts`

### Foundational implementation

- [x] T013 Add Module 2 enums and tenant-scoped Prisma entities from `data-model.md` to `packages/database/prisma/schema.prisma`
- [x] T014 Create reviewed Module 2 migration with temporal/value/scope CHECK constraints and composite foreign keys in `packages/database/prisma/migrations/202607190006_daily_kpi_engine/migration.sql`
- [x] T015 Add KPI permission catalog entries and idempotent three-KPI/default-policy sample data to `packages/database/prisma/seed.ts`
- [x] T016 Implement exact typed values, normalization, comparison and remaining arithmetic in `packages/domain/src/kpi/calculation.ts`
- [x] T017 Implement local-time window snapshots, exclusive 20:00 boundary and effective policy/target precedence in `packages/domain/src/kpi/policy.ts`
- [x] T018 Implement sole-current-branch resolver and `MULTIPLE_ACTIVE_BRANCHES` fail-safe result in `packages/domain/src/kpi/assignment.ts`
- [x] T019 Implement deterministic request/source/job digests and safe KPI redaction in `packages/domain/src/kpi/idempotency.ts`
- [x] T020 Implement tenant-safe base KPI configuration/report/job repository selectors and transaction types in `packages/database/src/kpi.repository.ts`
- [x] T021 Implement append-only KPI audit plus transactional outbox writer/claimer in `packages/database/src/kpi-governance.repository.ts`
- [x] T022 Implement bounded job-run lease/checkpoint repository in `packages/database/src/kpi-worker.repository.ts`
- [x] T023 Add fake source adapters, deterministic KPI clock and realtime/notification collectors in `packages/testing/src/kpi.ts`
- [x] T024 Export Module 2 repositories and testing helpers from `packages/database/src/index.ts` and `packages/testing/src/index.ts`

**Checkpoint**: Live PostgreSQL migration and seed reruns pass; pure rules pass with exact values and no tenant scope can be omitted by repository API.

---

## Phase 3: User Story 1 — Cấu hình KPI và policy nhiều cơ sở (Priority: P1)

**Goal**: Owner creates versioned KPI definitions, targets, mappings and tenant/branch policy versions, including atomic bulk application.

**Independent Test**: Create tenant default, two branch overrides and a member target, advance effective date and prove closed/current resolution uses the correct version with cross-tenant bulk denial.

### Tests for User Story 1

- [x] T025 [P] [US1] Add definitions/targets/mappings/policy OpenAPI success and error contract tests in `apps/api/tests/contract/kpi-config.contract.test.ts`
- [x] T026 [P] [US1] Add target precedence, overlap and immutable version service tests in `apps/api/tests/unit/kpi-config.service.test.ts`
- [x] T027 [US1] Add atomic multi-branch policy, RBAC scope, audit/outbox and cross-tenant integration tests in `apps/api/tests/integration/kpi-config.integration.test.ts`
- [x] T028 [US1] Add concurrent same-scope version creation and idempotency replay/conflict tests in `apps/api/tests/integration/kpi-config-concurrency.integration.test.ts`

### Implementation for User Story 1

- [x] T029 [US1] Implement KPI definition and immutable target/mapping version repository methods in `packages/database/src/kpi.repository.ts`
- [x] T030 [US1] Implement policy overlap checks, tenant fallback, branch override and atomic bulk writes in `packages/database/src/kpi.repository.ts`
- [x] T031 [US1] Implement definition/target/mapping validation and version services in `apps/api/src/modules/kpi/kpi-config-service.ts`
- [x] T032 [US1] Implement policy bulk preview/commit, reason/audit/idempotency and effective resolution in `apps/api/src/modules/kpi/kpi-policy-service.ts`
- [x] T033 [US1] Implement KPI definition/target/source-mapping endpoints in `apps/api/src/modules/kpi/kpi-config-routes.ts`
- [x] T034 [US1] Implement bulk policy and effective-policy endpoints in `apps/api/src/modules/kpi/kpi-policy-routes.ts`
- [x] T035 [US1] Add `kpi.configure`, `kpi.target.manage`, `kpi.policy.manage` and `kpi.view` scope evaluation in `packages/domain/src/authorization.ts`
- [x] T036 [US1] Add stable OpenAPI runtime examples and Module 2 config operation checks in `packages/contracts/src/kpi-openapi.test.ts`

**Checkpoint**: US1 passes independently; every config write is versioned, tenant-scoped, audited, idempotent and atomic.

---

## Phase 4: User Story 2 — Nộp báo cáo và biết phần còn thiếu (Priority: P1)

**Goal**: Employee records immutable daily report revisions and reads authoritative progress/action items with exact remaining values.

**Independent Test**: Submit two revisions in-window, retain both, use the newest eligible source and show one action item per missing KPI with exact remaining and deep-link.

### Tests for User Story 2

- [x] T037 [P] [US2] Add report revision/progress/personal action-item contract tests in `apps/api/tests/contract/kpi-report.contract.test.ts`
- [x] T038 [P] [US2] Add JSON Pointer source mapping, normalization and missing/error source unit tests in `apps/api/tests/unit/kpi-source.service.test.ts`
- [x] T039 [P] [US2] Add action-item projection/state-transition idempotency unit tests in `apps/api/tests/unit/action-item.service.test.ts`
- [x] T040 [US2] Add two-revision, exact-20:00-late, foreign-source and cross-employee/tenant integration tests in `apps/api/tests/integration/kpi-report.integration.test.ts`
- [x] T041 [US2] Add source-change recalculation, outbox and realtime-within-five-seconds integration tests in `apps/api/tests/integration/kpi-progress-realtime.integration.test.ts`

### Implementation for User Story 2

- [x] T042 [US2] Implement form-field and adapter source readers with version/digest ownership checks in `apps/api/src/modules/kpi/kpi-source-service.ts`
- [x] T043 [US2] Implement report header creation, immutable revision append and eligible-current selection in `packages/database/src/kpi.repository.ts`
- [x] T044 [US2] Implement append-only calculation event and current progress query methods in `packages/database/src/kpi.repository.ts`
- [x] T045 [US2] Implement report-window/source validation, revision idempotency and recalculation orchestration in `apps/api/src/modules/kpi/kpi-report-service.ts`
- [x] T046 [US2] Implement authoritative typed progress calculation/snapshot service in `apps/api/src/modules/kpi/kpi-progress-service.ts`
- [x] T047 [US2] Implement current action-item upsert plus append-only transition repository in `packages/database/src/action-item.repository.ts`
- [x] T048 [US2] Implement KPI report/shortfall action-item projection and event effects in `apps/api/src/modules/action-items/action-item-service.ts`
- [x] T049 [US2] Implement report revision/history and progress endpoints in `apps/api/src/modules/kpi/kpi-report-routes.ts`
- [x] T050 [US2] Implement employee action-item feed, cursor and badge endpoint in `apps/api/src/modules/action-items/action-item-routes.ts`
- [x] T051 [US2] Wire transactional `kpi.report.revision-created`, `kpi.progress.changed` and `action-item.changed` outbox events in `packages/database/src/kpi-governance.repository.ts`

**Checkpoint**: US2 passes independently; client cannot overwrite automatic actuals and employee reads only self-owned authoritative progress.

---

## Phase 5: User Story 3 — Đóng ngày và tạo đúng một khoản phạt KPI (Priority: P1)

**Goal**: Retry-safe worker closes daily KPI after the deadline, applies all-required logic and assesses at most one immutable KPI penalty per employee/day.

**Independent Test**: Run 100 retry/concurrent evaluation claims over passing, missing, late, exempt and multi-branch employees and prove exact unique outcomes/policy snapshots.

### Tests for User Story 3

- [x] T052 [P] [US3] Add all-required pass/fail, no-report, late-report and exemption unit tests in `packages/domain/src/kpi/evaluation.test.ts`
- [x] T053 [P] [US3] Add close-day lease/checkpoint/reclaim and poison-item continuation unit tests in `apps/worker/tests/unit/kpi-close-day.test.ts`
- [x] T054 [US3] Add live-PostgreSQL evaluation/penalty uniqueness under 100 retries and concurrent workers in `apps/worker/tests/integration/kpi-close-day-concurrency.integration.test.ts`
- [x] T055 [US3] Add policy-change historical snapshot, sole-branch data-error and job resume integration tests in `apps/worker/tests/integration/kpi-close-day.integration.test.ts`
- [x] T056 [US3] Add evaluation list/rerun acceptance, authorization and idempotency contract tests in `apps/api/tests/contract/kpi-evaluation.contract.test.ts`

### Implementation for User Story 3

- [x] T057 [US3] Implement pure closing decision and failed-detail snapshot in `packages/domain/src/kpi/evaluation.ts`
- [x] T058 [US3] Implement evaluation insert/read uniqueness and immutable history methods in `packages/database/src/kpi-worker.repository.ts`
- [x] T059 [US3] Implement daily KPI penalty assessment with the `DAILY_KPI` unique business key in `packages/database/src/kpi-worker.repository.ts`
- [x] T060 [US3] Implement close-day candidate paging and snapshotted policy/branch/source resolution in `apps/worker/src/kpi/close-day-service.ts`
- [x] T061 [US3] Implement per-employee transaction, exemption, missing/late report and failed-detail handling in `apps/worker/src/kpi/close-day-service.ts`
- [x] T062 [US3] Implement lease/checkpoint/retry/partial-failure runner in `apps/worker/src/kpi/close-day-runner.ts`
- [x] T063 [US3] Implement safe `MULTIPLE_ACTIVE_BRANCHES` data-quality action-item effect without penalty in `apps/worker/src/kpi/close-day-service.ts`
- [x] T064 [US3] Emit evaluation/penalty/action-item outbox events in the same close transaction through `packages/database/src/kpi-governance.repository.ts`
- [x] T065 [US3] Implement authorized evaluation history and retry-safe rerun enqueue service in `apps/api/src/modules/kpi/kpi-evaluation-service.ts`
- [x] T066 [US3] Implement evaluation list and rerun endpoints in `apps/api/src/modules/kpi/kpi-evaluation-routes.ts`
- [x] T067 [US3] Add bounded close-day/outbox metrics, redacted logs and readiness signals in `apps/worker/src/observability.ts`

**Checkpoint**: US3 passes independently; no retry/concurrency path can double-close or double-charge, and closed history never follows a new policy.

---

## Phase 6: User Story 4 — Quản lý thiếu hụt và điều chỉnh có kiểm soát (Priority: P2)

**Goal**: Authorized managers read scoped aggregates/history, enqueue reruns and create append-only penalty adjustments.

**Independent Test**: A one-branch manager sees only that branch, cannot access another tenant/branch, and a replayed adjustment produces one ledger entry while preserving original penalty.

### Tests for User Story 4

- [x] T068 [P] [US4] Add manager action-item filters/summary and penalty adjustment contract tests in `apps/api/tests/contract/kpi-management.contract.test.ts`
- [x] T069 [P] [US4] Add effective-amount, non-negative and full-reversal unit tests in `packages/domain/src/kpi/penalty.test.ts`
- [x] T070 [US4] Add manager branch matrix, aggregate non-leakage and cursor integration tests in `apps/api/tests/integration/kpi-management-isolation.integration.test.ts`
- [x] T071 [US4] Add adjustment idempotency/conflict/concurrency, audit and outbox integration tests in `apps/api/tests/integration/kpi-adjustment.integration.test.ts`

### Implementation for User Story 4

- [x] T072 [US4] Implement signed adjustment/effective-amount invariant in `packages/domain/src/kpi/penalty.ts`
- [x] T073 [US4] Implement scoped manager action-item filters, counts and stable cursor repository in `packages/database/src/action-item.repository.ts`
- [x] T074 [US4] Implement penalty detail/adjustment ledger repository with locking in `packages/database/src/kpi.repository.ts`
- [x] T075 [US4] Implement branch-scoped manager feed and aggregate service in `apps/api/src/modules/action-items/action-item-management-service.ts`
- [x] T076 [US4] Implement append-only adjustment, reason/audit/idempotency and event service in `apps/api/src/modules/kpi/kpi-penalty-service.ts`
- [x] T077 [US4] Implement manager action-item endpoint in `apps/api/src/modules/action-items/action-item-management-routes.ts`
- [x] T078 [US4] Implement penalty adjustment endpoint in `apps/api/src/modules/kpi/kpi-penalty-routes.ts`
- [x] T079 [US4] Add `kpi.evaluation.view`, `kpi.evaluation.rerun`, `kpi.penalty.adjust` branch/tenant scope rules in `packages/domain/src/authorization.ts`

**Checkpoint**: US4 passes independently; aggregates never leak out of scope and all financial corrections are explainable append-only events.

---

## Phase 7: User Story 5 — Hoàn tất ảnh minh chứng khi policy yêu cầu (Priority: P2)

**Goal**: Configured reports create exact photo debt, accept only authorized READY media and finalize reminder/penalty effects idempotently.

**Independent Test**: One report satisfies debt in grace while another expires; 100 reminder/finalization retries create one terminal transition/effect and no hash fraud decision.

### Tests for User Story 5

- [x] T080 [P] [US5] Add required-photo-count and evidence state-machine unit tests in `packages/domain/src/kpi/evidence.test.ts`
- [x] T081 [P] [US5] Add evidence refresh success/authorization/error contract tests in `apps/api/tests/contract/kpi-evidence.contract.test.ts`
- [x] T082 [US5] Add matching READY versus wrong-tenant/owner/source/status media integration tests in `apps/api/tests/integration/kpi-evidence.integration.test.ts`
- [x] T083 [US5] Add 100 reminder/finalization retries, optional amount and no-phash-decision integration tests in `apps/worker/tests/integration/kpi-evidence-worker.integration.test.ts`

### Implementation for User Story 5

- [x] T084 [US5] Implement evidence required-count and terminal state transitions in `packages/domain/src/kpi/evidence.ts`
- [x] T085 [US5] Implement evidence debt/media count repository with tenant-owner-source/status predicates in `packages/database/src/kpi-evidence.repository.ts`
- [x] T086 [US5] Create/refresh photo debt and project the exact remaining-photo action item in `apps/api/src/modules/kpi/kpi-evidence-service.ts`
- [x] T087 [US5] Implement authorized evidence refresh endpoint in `apps/api/src/modules/kpi/kpi-evidence-routes.ts`
- [x] T088 [US5] Implement reminder and overdue candidate claim/finalization service in `apps/worker/src/kpi/evidence-debt-runner.ts`
- [x] T089 [US5] Implement optional `PHOTO_EVIDENCE` penalty keyed by debt plus unique reminder/finalization outbox effects in `apps/worker/src/kpi/evidence-debt-service.ts`
- [x] T090 [US5] Keep perceptual fingerprint fields nullable and disabled with an explicit no-decision adapter in `packages/domain/src/kpi/evidence.ts`

**Checkpoint**: US5 passes independently; evidence behavior is policy-gated, tenant-safe, retry-safe and does not make fraud claims.

---

## Phase 8: Outbox delivery, documentation and module gate

**Purpose**: Integrate all stories, close traceability/operations gaps and prove Module 2 is safe for Module 3.

- [x] T091 Add outbox dispatcher unit tests for lease, retry, same-event dedupe and dead-letter in `apps/worker/tests/unit/outbox-dispatcher.test.ts`
- [x] T092 Add realtime/notification delivery integration tests with local collectors in `apps/worker/tests/integration/kpi-outbox.integration.test.ts`
- [x] T093 Implement bounded outbox dispatcher and Module 1 adapter fan-out in `apps/worker/src/outbox/outbox-dispatcher.ts`
- [x] T094 Wire worker startup/shutdown, signal handling and dependency readiness in `apps/worker/src/index.ts`
- [x] T095 Add API and worker KPI-safe logging/metrics tests in `apps/api/tests/integration/kpi-observability.integration.test.ts`
- [x] T096 Add cross-endpoint runtime conformance for all Module 2 OpenAPI operations in `apps/api/tests/contract/kpi-published-http.contract.test.ts`
- [x] T097 Add clean-deploy, Module 1 upgrade and migration drift verification to `tests/migration/kpi.migration.test.ts`
- [x] T098 Add deterministic Module 2 seed verification utility in `packages/database/prisma/verify-kpi-seed.ts`
- [x] T099 Add 10.000-membership close-day checkpoint fixture and progress/action-item p95 load runner in `tests/load/kpi-smoke-runner.mjs`
- [x] T100 Execute and document Module 2 quickstart scenarios in `specs/002-okr-kpi-engine/verification.md`
- [x] T101 [P] Document KPI source adapter integration for Module 3 in `docs/architecture/kpi-source-adapters.md`
- [x] T102 [P] Document KPI permissions, policy precedence, exact 20:00 boundary and correction ledger in `docs/architecture/daily-kpi.md`
- [x] T103 Complete FR/CR-to-test traceability and verify no requirement lacks an automated gate in `specs/002-okr-kpi-engine/verification.md`
- [x] T104 Run Prisma format/validate/generate/deploy/status, three seed reruns and live migration tests; record commands/results in `specs/002-okr-kpi-engine/verification.md`
- [x] T105 Run format check, lint, typecheck, unit, contract, integration, worker retry/concurrency, coverage and build gates; record results in `specs/002-okr-kpi-engine/verification.md`
- [x] T106 Run load smoke, secret scan, log/outbox redaction audit and quickstart validation; record limitations and results in `specs/002-okr-kpi-engine/verification.md`

**Module 2 Gate**: Contracts, migrations, shared source adapter, all automated gates and convergence are stable before Module 3 starts.

---

## Dependencies and execution order

### Phase dependencies

- Phase 1 → Phase 2 is strictly sequential.
- Phase 2 blocks every user story.
- US1 provides effective configuration to US2/US3/US5.
- US2 provides report/progress/action-item projections to US3/US4/US5.
- US3 provides closed evaluation/penalty to US4.
- US5 may start after US2 but is delivered after US4 to preserve the requested story sequence.
- Phase 8 starts only after US1–US5 checkpoints pass.

### Within each story

1. Create tests and prove they fail for the intended missing behavior.
2. Complete repository/domain behavior before application services.
3. Complete services before routes/workers.
4. Run the story's unit/contract/integration checkpoint before marking implementation tasks complete.
5. Keep one active implementation task at a time even where `[P]` indicates independent file ownership.

## Requirement trace summary

| Requirement group | Primary tasks |
|---|---|
| FR-001–FR-007 | T025–T036 |
| FR-008–FR-013 | T037–T051 |
| FR-014–FR-018 | T052–T079 |
| FR-019–FR-021 | T080–T090 |
| FR-022–FR-025 | T039, T047–T050, T068, T073–T077 |
| FR-026–FR-029 | T019–T022, T028, T041, T054–T064, T071, T091–T098 |
| FR-030 | T090, T102–T103 |
| CR-001–CR-006 | T008–T024, all integration gates, T095–T106 |

| SC-001–SC-002 | T027–T032, T040, T070, T082 |
| SC-003–SC-004 | T009, T040, T052–T055 |
| SC-005–SC-006 | T008, T039, T041, T047–T052 |
| SC-007–SC-008 | T025, T037, T056, T068, T081, T083, T096 |
| SC-009 | T053, T055, T067, T099, T106 |

## Notes

- `[P]` means file-independent, not permission to violate the one-active-stage/project sequence.
- Tests are written first and must fail for the intended missing behavior before implementation.
- Task completion requires the named file plus its directly relevant verification, not only file creation.
- No task may silently add advanced OKR, weekly check-in, attendance ownership, booking/export or mobile UI.
