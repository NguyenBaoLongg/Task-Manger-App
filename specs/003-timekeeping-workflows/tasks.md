# Tasks: Chấm công và workflow duyệt

**Input**: Design documents from `/specs/003-timekeeping-workflows/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `checklists/timekeeping-quality.md`

**Tests**: Tests are mandatory under the Adsup Constitution. Every buildable requirement must include the appropriate unit, contract, integration, tenant-isolation, migration, worker retry/concurrency, or load verification task before implementation is marked complete.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks.
- **[Story]**: Which user story this task belongs to (`US1` to `US5`).
- Every task includes exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add Module 3 entry points and file structure without implementing business behavior yet.

- [X] T001 Add the timekeeping OpenAPI loader/export beside existing spec loaders in `packages/contracts/src/index.ts`
- [X] T002 [P] Create attendance contract schema entry point in `packages/contracts/src/attendance.ts`
- [X] T003 [P] Create attendance domain barrel in `packages/domain/src/attendance/index.ts`
- [X] T004 [P] Create workflow domain barrel in `packages/domain/src/workflows/index.ts`
- [X] T005 Export attendance and workflow domain barrels from `packages/domain/src/index.ts`
- [X] T006 [P] Create attendance API route entry point in `apps/api/src/modules/attendance/attendance-routes.ts`
- [X] T007 [P] Create workflow API route entry point in `apps/api/src/modules/workflows/workflow-routes.ts`
- [X] T008 [P] Create penalty API route entry point in `apps/api/src/modules/penalties/penalty-routes.ts`
- [X] T009 [P] Create attendance worker scheduler entry point in `apps/worker/src/attendance/scheduler.ts`
- [X] T010 Add optional Module 3 service dependencies and route mounting placeholders in `apps/api/src/app.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema, contracts, repositories, permissions, seed and test foundations required before any user story can be implemented.

**Critical**: No user story work can begin until this phase is complete.

### Tests and Contracts

- [X] T011 [P] Add migration clean-deploy and Module 2 upgrade-path tests for Module 3 tables in `tests/migration/timekeeping.migration.test.ts`
- [X] T012 [P] Add deterministic seed rerun verification for shifts, `VideoPolicyVersion`, `AttendancePenaltyPolicyVersion`, workflows and OFF calendar examples in `tests/migration/timekeeping-seed.integration.test.ts`
- [X] T013 [P] Add OpenAPI validation coverage for `specs/003-timekeeping-workflows/contracts/openapi.yaml` in `packages/contracts/src/timekeeping-openapi.test.ts`
- [X] T014 [P] Add published HTTP contract coverage for Module 3 problem responses, auth, idempotency and pagination in `apps/api/tests/contract/timekeeping-published-http.contract.test.ts`

### Database, RBAC and Shared Infrastructure

- [X] T015 Add Module 3 enums and tenant-scoped models from `data-model.md` to `packages/database/prisma/schema.prisma`
- [X] T016 Create deterministic migration SQL for Module 3 schema, indexes, tenant foreign keys and unique idempotency keys in `packages/database/prisma/migrations/202607210001_timekeeping_workflows/migration.sql`
- [X] T017 Add Module 3 permissions for schedules, attendance, video policy configuration, video review, penalty policy configuration, workflows, leave, OFF calendar, penalties and legal hold to `packages/database/prisma/seed.ts`
- [X] T018 Add deterministic Module 3 seed data and idempotent verification helper for shifts, `VideoPolicyVersion`, `AttendancePenaltyPolicyVersion`, workflow definitions and OFF calendar examples in `packages/database/prisma/verify-timekeeping-seed.ts`
- [X] T019 [P] Create tenant-scoped attendance repository skeleton for schedules, check-ins, OFF calendar and day-close reads in `packages/database/src/attendance.repository.ts`
- [X] T020 [P] Create workflow repository skeleton for definitions, requests, steps and decisions in `packages/database/src/workflow.repository.ts`
- [X] T021 [P] Create penalty repository skeleton for violations, settlements, adjustments and payment transitions in `packages/database/src/penalty.repository.ts`
- [X] T022 [P] Create attendance worker repository skeleton for day close, media conversion, monthly absence and job cursors in `packages/database/src/attendance-worker.repository.ts`
- [X] T023 Export Module 3 repositories from `packages/database/src/index.ts`
- [X] T024 [P] Add deterministic clocks, tenant timezone helpers and Module 3 fixture builders in `packages/testing/src/timekeeping.ts`
- [X] T025 [P] Add shared attendance money/time/type primitives in `packages/domain/src/attendance/types.ts`
- [X] T026 [P] Add shared workflow request/decision type primitives in `packages/domain/src/workflows/types.ts`
- [X] T027 Add Module 3 dependency wiring for repositories and services in `apps/api/src/index.ts`
- [X] T028 Add Module 3 worker wiring for attendance scheduler, day close, video conversion and monthly absence jobs in `apps/worker/src/index.ts`

**Checkpoint**: Foundation ready. User story implementation can now proceed in priority order.

---

## Phase 3: User Story 1 - Đăng ký và giữ lịch ca đúng lịch sử (Priority: P1) MVP

**Goal**: Employees can register/edit schedules under the 24-hour rule while every schedule version and check-in snapshot remains historically reproducible.

**Independent Test**: Create an employee schedule, self-edit it before the 24-hour cutoff, require an approval request inside 24 hours, perform a manager post-start adjustment with reason, and prove later attendance references the correct schedule snapshot.

### Tests for User Story 1

- [X] T029 [P] [US1] Add unit tests for schedule versioning, 24-hour cutoff and timezone boundaries in `packages/domain/src/attendance/schedule.test.ts`
- [X] T030 [P] [US1] Add contract tests for shift and schedule endpoints in `apps/api/tests/contract/attendance-schedules.contract.test.ts`
- [X] T031 [P] [US1] Add integration tests for schedule registration, self-edit, approval-required change and manager adjustment in `apps/api/tests/integration/attendance-schedule.integration.test.ts`
- [X] T032 [P] [US1] Add negative tenant/branch isolation tests for schedule and shift reads/writes in `apps/api/tests/integration/attendance-schedule-isolation.integration.test.ts`

### Implementation for User Story 1

- [X] T033 [P] [US1] Implement pure schedule cutoff, effective-version and branch fail-safe rules in `packages/domain/src/attendance/schedule.ts`
- [X] T034 [US1] Implement `ShiftDefinition` and `WorkScheduleVersion` repository methods with tenant composite keys and audit/outbox writes in `packages/database/src/attendance.repository.ts`
- [X] T035 [US1] Implement schedule application service with RBAC scope, idempotency and reason handling in `apps/api/src/modules/attendance/schedule-service.ts`
- [X] T036 [US1] Implement `GET /attendance/shifts` and schedule list/create endpoints from OpenAPI in `apps/api/src/modules/attendance/attendance-routes.ts`
- [X] T037 [US1] Add schedule action-item source creation/closure for blocked changes and approval-needed changes in `apps/api/src/modules/attendance/schedule-service.ts`
- [X] T038 [US1] Register attendance schedule routes and service dependencies in `apps/api/src/app.ts`
- [X] T039 [US1] Seed default 08:30 and 09:30 shifts idempotently for tenant sample data in `packages/database/prisma/seed.ts`
- [X] T040 [US1] Update Module 3 seed verification for default shifts and schedule permissions in `packages/database/prisma/verify-timekeeping-seed.ts`

**Checkpoint**: User Story 1 is independently testable.

---

## Phase 4: User Story 2 - Check-in video và tính đi muộn có thể giải thích (Priority: P1)

**Goal**: Employees acknowledge the video policy, check in with governed video media, and receive explainable late classification and penalties without AI auto-scoring.

**Independent Test**: Check in at 08:30:59, 08:45:59, 08:46:00, after 15:00, and no-check-in after 18:00; verify schedule snapshot, media lifecycle, manual video review and late/no-check-in outputs.

### Tests for User Story 2

- [X] T041 [P] [US2] Add unit tests for check-in timestamp normalization, late-minute rounding, 15:00/18:00 classification and `queue_impact_flag` behavior in `packages/domain/src/attendance/time.test.ts`
- [X] T042 [P] [US2] Add unit tests for first-late exemption, 1-15/16-89/90+ tiers, approved late discount and no-notice surcharge in `packages/domain/src/attendance/late-penalty.test.ts`
- [X] T043 [P] [US2] Add contract tests for video policy version configuration, acknowledgement, check-in and manual video review endpoints in `apps/api/tests/contract/attendance-checkin.contract.test.ts`
- [X] T044 [P] [US2] Add integration tests for video policy acknowledgement, check-in snapshot and manual failed video review in `apps/api/tests/integration/attendance-checkin.integration.test.ts`
- [X] T045 [P] [US2] Add worker retry tests for video conversion READY/FAILED states without duplicate media or violations in `apps/worker/tests/unit/attendance-video-conversion.test.ts`
- [X] T046 [P] [US2] Add integration tests for day-close missing check-in, after-15:00 worked-late, after-18:00 non-worked classification and tenant/branch queue-impact signal creation for late worked days in `apps/worker/tests/integration/attendance-day-close.integration.test.ts`

### Implementation for User Story 2

- [X] T047 [P] [US2] Implement pure attendance time calculations, report eligibility classification and authoritative queue-impact signal derivation in `packages/domain/src/attendance/time.ts`
- [X] T048 [P] [US2] Implement pure late-penalty calculation using policy snapshots and integer VND minor units in `packages/domain/src/attendance/late-penalty.ts`
- [X] T049 [US2] Add Zod schemas for video policy version configuration, acknowledgement, check-in upload metadata and manual review payloads in `packages/contracts/src/attendance.ts`
- [X] T050 [US2] Implement `VideoPolicyVersion`, `VideoPolicyAcknowledgement`, `AttendanceEvent`, `CheckInVideoAsset`, `VideoReviewResult` and `LateOccurrence.queue_impact_flag` repository methods in `packages/database/src/attendance.repository.ts`
- [X] T051 [US2] Implement video policy version configuration, acknowledgement and check-in command handling with tenant-derived scope and idempotency in `apps/api/src/modules/attendance/attendance-service.ts`
- [X] T052 [US2] Implement manual video review service with reviewer permission checks and no AI auto-decision path in `apps/api/src/modules/attendance/video-review-service.ts`
- [X] T053 [US2] Implement video policy configuration, check-in, acknowledgement and review routes from OpenAPI in `apps/api/src/modules/attendance/attendance-routes.ts`
- [X] T054 [US2] Implement retry-safe media conversion runner that converts governed video assets asynchronously in `apps/worker/src/attendance/video-conversion-runner.ts`
- [X] T055 [US2] Implement tenant-timezone day-close runner for missing check-in and non-worked classification in `apps/worker/src/attendance/day-close-runner.ts`
- [X] T056 [US2] Add redacted media access and no signed-URL logging checks for attendance video flows in `apps/api/src/modules/media/media-service.ts`
- [X] T057 [US2] Create/close action items for missing video, conversion failure and video review needs in `packages/database/src/action-item.repository.ts`
- [X] T058 [US2] Register attendance video conversion and day-close jobs in `apps/worker/src/attendance/scheduler.ts`

**Checkpoint**: User Story 2 is independently testable after User Story 1 schedule snapshots exist.

---

## Phase 5: User Story 3 - Duyệt đơn đi muộn, đổi ca và nghỉ theo cấu hình tenant (Priority: P1)

**Goal**: Tenant Owners configure Module 3 approval workflows, employees submit supported requests, approvers decide safely, and routing/decision effects apply exactly once.

**Independent Test**: Configure one-level, sequential and parallel workflows; submit shift-change, late-notice and leave requests through `/workflows/requests`; process concurrent approver decisions and verify routing, decision state, notifications and shift-change/late-notice effects are produced once, while leave schedule final effects are completed in US4.

### Tests for User Story 3

- [X] T059 [P] [US3] Add unit tests for one-level, sequential and parallel approval state-machine transitions in `packages/domain/src/workflows/state-machine.test.ts`
- [X] T060 [P] [US3] Add contract tests for workflow definition, request submission and approval decision endpoints in `apps/api/tests/contract/workflows.contract.test.ts`
- [X] T061 [P] [US3] Add integration tests for workflow configuration, request routing via `/workflows/requests`, decision state and notification/action-item creation without leave schedule final effects in `apps/api/tests/integration/workflows.integration.test.ts`
- [X] T062 [P] [US3] Add concurrency and idempotency integration tests for 100 duplicate/concurrent approval decisions in `apps/api/tests/integration/workflows-concurrency.integration.test.ts`
- [X] T063 [P] [US3] Add tenant/branch approver denial tests for cross-tenant and out-of-scope approvers in `apps/api/tests/integration/workflows-isolation.integration.test.ts`

### Implementation for User Story 3

- [X] T064 [P] [US3] Implement workflow state machine completion rules and decision validation in `packages/domain/src/workflows/state-machine.ts`
- [X] T065 [US3] Add workflow schemas for definition versions, request submission and decisions in `packages/contracts/src/attendance.ts`
- [X] T066 [US3] Implement `WorkflowDefinitionVersion`, `ApprovalRequest`, `ApprovalRunStep` and `ApprovalDecisionRecord` repository methods with row locking in `packages/database/src/workflow.repository.ts`
- [X] T067 [US3] Implement workflow configuration, request submission for shift-change, late-notice, leave and sudden-leave payloads, and approver resolution in `apps/api/src/modules/workflows/workflow-service.ts`
- [X] T068 [US3] Implement idempotent approval decision finalization and single-effect application in `apps/api/src/modules/workflows/workflow-service.ts`
- [X] T069 [US3] Implement workflow routes from OpenAPI with authenticated tenant context, RBAC and idempotency in `apps/api/src/modules/workflows/workflow-routes.ts`
- [X] T070 [US3] Integrate final effects for approved shift-change and late-notice requests only; leave schedule final effects remain in US4 in `apps/api/src/modules/workflows/workflow-effects.ts`
- [X] T071 [US3] Add outbox, notification and action-item effects for submitted, activated, decided and resolved workflow events in `packages/database/src/workflow.repository.ts`
- [X] T072 [US3] Register workflow routes and service dependencies in `apps/api/src/app.ts`
- [X] T073 [US3] Seed default Module 3 workflow definitions idempotently in `packages/database/prisma/seed.ts`

**Checkpoint**: User Story 3 is independently testable for shift-change and late-notice flows, with leave final effects completed in User Story 4.

---

## Phase 6: User Story 4 - Quản lý lịch nghỉ, nghỉ đột xuất và xung đột lịch nghỉ (Priority: P2)

**Goal**: Employees can request schedule leave or sudden leave for full day, morning half-day or date ranges; managers set company/branch OFF days; leave conflicts, consecutive-day rules and monthly over-threshold notifications are enforced.

**Independent Test**: Submit overlapping leave for same branch and department/position, submit leave in another branch, set company OFF days, approve half-day and multi-day ranges, and verify over-5-day monthly reminder/flag behavior.

### Tests for User Story 4

- [X] T074 [P] [US4] Add unit tests for OFF calendar resolution, leave range expansion, morning half-day counting and consecutive-day rules in `packages/domain/src/attendance/absence.test.ts`
- [X] T075 [P] [US4] Add contract tests for OFF calendar and monthly absence summary endpoints plus leave/sudden-leave request payloads submitted through `/workflows/requests` in `apps/api/tests/contract/attendance-leave.contract.test.ts`
- [X] T076 [P] [US4] Add integration tests for leave conflict detection at submit and approval time in `apps/api/tests/integration/attendance-leave-conflicts.integration.test.ts`
- [X] T077 [P] [US4] Add integration tests for tenant-wide and branch-specific OFF calendar suppression of check-in, penalties and KPI report requirement in `apps/api/tests/integration/attendance-off-calendar.integration.test.ts`
- [X] T078 [P] [US4] Add worker tests for monthly absence threshold idempotent notification and employee over-limit flag in `apps/worker/tests/integration/attendance-monthly-absence.integration.test.ts`

### Implementation for User Story 4

- [X] T079 [P] [US4] Implement pure absence, OFF calendar, leave conflict and consecutive-day exception rules in `packages/domain/src/attendance/absence.ts`
- [X] T080 [US4] Add schemas for company OFF calendar, leave/sudden-leave workflow payloads and monthly absence summary filters in `packages/contracts/src/attendance.ts`
- [X] T081 [US4] Implement `CompanyOffCalendarVersion`, `LeaveConflictSnapshot` and `MonthlyAbsenceSummary` repository methods in `packages/database/src/attendance.repository.ts`
- [X] T082 [US4] Implement leave and sudden-leave service with full-day, morning half-day and date-range support in `apps/api/src/modules/attendance/leave-service.ts`
- [X] T083 [US4] Implement OFF calendar service with tenant-wide and branch-scoped version/audit behavior in `apps/api/src/modules/attendance/off-calendar-service.ts`
- [X] T084 [US4] Implement OFF calendar and monthly summary routes from OpenAPI; leave/sudden-leave requests continue through `/workflows/requests` in `apps/api/src/modules/attendance/attendance-routes.ts`
- [X] T085 [US4] Add transactional leave conflict detection against effective branch, department and position assignments in `packages/database/src/attendance.repository.ts`
- [X] T086 [US4] Complete leave approval final effects that update schedules to `OFF` or leave state exactly once in `apps/api/src/modules/workflows/workflow-effects.ts`
- [X] T087 [US4] Implement monthly absence summary worker with manager notification and over-threshold flagging in `apps/worker/src/attendance/monthly-absence-runner.ts`
- [X] T088 [US4] Ensure company OFF days suppress day-close penalties and KPI report eligibility in `apps/worker/src/attendance/day-close-runner.ts`
- [X] T089 [US4] Seed company/branch OFF calendar examples without counting them as personal leave in `packages/database/prisma/seed.ts`

**Checkpoint**: User Story 4 is independently testable for leave/OFF behavior after workflow foundations exist.

---

## Phase 7: User Story 5 - Sổ phạt và nguồn chấm công cho vận hành sau này (Priority: P2)

**Goal**: Internal penalty ledger is explainable and append-only, payment transitions are controlled, and Module 3 exposes authoritative attendance source snapshots for Module 2 KPI.

**Independent Test**: Create same-day video failure, late occurrence and no-notice violation; settle only the higher base amount plus independent no-notice amount; process payment transitions; query `ATTENDANCE_ON_TIME_RATE` without leaking media metadata.

### Tests for User Story 5

- [X] T090 [P] [US5] Add unit tests for video-vs-late max settlement, independent no-notice surcharge and adjustment arithmetic in `packages/domain/src/attendance/penalty-settlement.test.ts`
- [X] T091 [P] [US5] Add contract tests for attendance penalty policy version configuration, settlement list and payment transition endpoints in `apps/api/tests/contract/attendance-penalties.contract.test.ts`
- [X] T092 [P] [US5] Add integration tests for violation assessment, monthly settlement, payment confirm/reject/waive/refund and audit history in `apps/api/tests/integration/attendance-penalties.integration.test.ts`
- [X] T093 [P] [US5] Add unit tests for the Module 2 attendance KPI source adapter outcomes `100`, `0` and `null` in `apps/api/tests/unit/attendance-kpi-source.service.test.ts`
- [X] T094 [P] [US5] Add integration tests proving KPI source snapshots, logs and outbox events do not contain video URLs, raw evidence or signed tokens in `apps/api/tests/integration/attendance-privacy.integration.test.ts`

### Implementation for User Story 5

- [X] T095 [P] [US5] Implement pure penalty settlement rules and explainable suppression reasons in `packages/domain/src/attendance/penalty-settlement.ts`
- [X] T096 [US5] Add schemas for attendance penalty policy version configuration, settlement filters and payment transitions in `packages/contracts/src/attendance.ts`
- [X] T097 [US5] Implement `AttendancePenaltyPolicyVersion`, `AttendanceViolation`, `PenaltySettlement` and `PenaltyPaymentTransition` repository methods in `packages/database/src/penalty.repository.ts`
- [X] T098 [US5] Implement attendance penalty policy version configuration and penalty settlement service with append-only adjustments and no payroll/payment-gateway dependency in `apps/api/src/modules/penalties/penalty-service.ts`
- [X] T099 [US5] Implement attendance penalty policy configuration, settlement list and payment transition routes from OpenAPI in `apps/api/src/modules/penalties/penalty-routes.ts`
- [X] T100 [US5] Register penalty routes and service dependencies in `apps/api/src/app.ts`
- [X] T101 [US5] Implement attendance KPI source adapter for `ATTENDANCE_ON_TIME_RATE` using confirmed attendance snapshots in `apps/api/src/modules/kpi/kpi-source-service.ts`
- [X] T102 [US5] Add attendance source mapping support to KPI repository reads without changing closed KPI history in `packages/database/src/kpi.repository.ts`
- [X] T103 [US5] Create/close action items for penalty payment needs and rejected payment proofs in `packages/database/src/action-item.repository.ts`
- [X] T104 [US5] Add redacted penalty and KPI outbox payloads for settlement, payment transition and attendance source changes in `packages/database/src/penalty.repository.ts`

**Checkpoint**: User Story 5 is independently testable after attendance, workflow and leave sources can generate violations.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Close gaps across contracts, docs, privacy, performance and module gates after selected user stories are implemented.

- [X] T105 [P] Complete requirement-to-task-to-test traceability for FR-001 through FR-049 and CR-001 through CR-006 in `specs/003-timekeeping-workflows/tasks.md`
- [X] T106 [P] Update local validation notes for any implementation-specific commands discovered during development in `specs/003-timekeeping-workflows/quickstart.md`
- [X] T107 [P] Add Module 3 load smoke profile for 10.000 video check-ins/day and p95 attendance/action-item reads, then wire it into `tests/load/smoke-runner.mjs` from `tests/load/timekeeping-smoke-runner.mjs`
- [X] T108 [P] Add secret, signed URL, evidence redaction, retention, tombstone and legal-hold regression coverage for API and worker logs in `apps/api/tests/integration/security-regression.integration.test.ts`
- [X] T109 Implement Module 3 media retention, tombstone and legal-hold worker integration for attendance video, leave evidence and payment proof media in `apps/worker/src/attendance/media-retention-runner.ts`
- [X] T110 Run and fix Module 3 format, lint and typecheck gates from `package.json`
- [X] T111 Run and fix Module 3 unit, contract, integration, migration and worker retry/concurrency tests from `package.json`
- [X] T112 Run and fix Module 3 coverage, build and load smoke evidence from `package.json`
- [X] T113 Re-run quickstart scenarios 1 through 8 and record pass/fail evidence in `specs/003-timekeeping-workflows/quickstart.md`
- [X] T114 Prepare for `$speckit-converge` by confirming no task references implementation outside Module 3 scope in `specs/003-timekeeping-workflows/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 US1**: Depends on Phase 2.
- **Phase 4 US2**: Depends on Phase 2 and practically depends on US1 schedule snapshots for full verification.
- **Phase 5 US3**: Depends on Phase 2; shift-change and late-notice effects integrate with US1/US2, while leave effects finish with US4.
- **Phase 6 US4**: Depends on Phase 2 and uses US3 approval finalization for leave decisions.
- **Phase 7 US5**: Depends on US2, US3 and US4 sources for complete penalty and KPI source coverage.
- **Phase 8 Polish**: Depends on all selected user stories.

### User Story Dependencies

- **US1 (P1)**: First MVP slice; no dependency on later stories.
- **US2 (P1)**: Requires US1 schedule snapshots to verify check-in and late calculations end to end.
- **US3 (P1)**: Can build the workflow engine after Foundation, then integrate final effects with US1/US2 and US4.
- **US4 (P2)**: Requires workflow finalization for approved leave effects and schedule OFF updates.
- **US5 (P2)**: Requires attendance, workflow and leave violation sources before final settlement/KPI integration is complete.

### Within Each User Story

- Tests must be written first and fail before implementation.
- Contracts before route implementation.
- Domain rules before services.
- Prisma schema/migration before repository methods.
- Repository methods before API services.
- Services before routes and worker integration.
- Idempotency, audit and tenant isolation are part of the same task, not optional follow-up work.

---

## Parallel Opportunities

- Setup tasks T002 through T009 can run in parallel after T001 is clear.
- Foundational tests T011 through T014 can run in parallel with repository skeleton tasks T019 through T022.
- Within each user story, test files marked `[P]` can be created in parallel.
- Domain tasks in different files can run in parallel with contract tests for the same story.
- US3 workflow engine work can begin after Foundation while US2 media/day-close work continues, but final effects must respect the dependency graph.
- US4 OFF calendar work can run in parallel with leave conflict work after Foundation.
- US5 KPI source adapter tests can run in parallel with penalty contract tests after US2 classification shape is stable.

## Parallel Example: User Story 1

```text
Task T029: Add unit tests in packages/domain/src/attendance/schedule.test.ts
Task T030: Add contract tests in apps/api/tests/contract/attendance-schedules.contract.test.ts
Task T031: Add integration tests in apps/api/tests/integration/attendance-schedule.integration.test.ts
Task T032: Add isolation tests in apps/api/tests/integration/attendance-schedule-isolation.integration.test.ts
```

## Parallel Example: User Story 2

```text
Task T041: Add time calculation tests in packages/domain/src/attendance/time.test.ts
Task T042: Add late penalty tests in packages/domain/src/attendance/late-penalty.test.ts
Task T043: Add check-in contract tests in apps/api/tests/contract/attendance-checkin.contract.test.ts
Task T045: Add video conversion worker tests in apps/worker/tests/unit/attendance-video-conversion.test.ts
```

## Parallel Example: User Story 3

```text
Task T059: Add workflow state machine tests in packages/domain/src/workflows/state-machine.test.ts
Task T060: Add workflow contract tests in apps/api/tests/contract/workflows.contract.test.ts
Task T061: Add workflow integration tests in apps/api/tests/integration/workflows.integration.test.ts
Task T063: Add workflow isolation tests in apps/api/tests/integration/workflows-isolation.integration.test.ts
```

## Parallel Example: User Story 4

```text
Task T074: Add absence domain tests in packages/domain/src/attendance/absence.test.ts
Task T075: Add leave contract tests in apps/api/tests/contract/attendance-leave.contract.test.ts
Task T076: Add leave conflict integration tests in apps/api/tests/integration/attendance-leave-conflicts.integration.test.ts
Task T078: Add monthly absence worker tests in apps/worker/tests/integration/attendance-monthly-absence.integration.test.ts
```

## Parallel Example: User Story 5

```text
Task T090: Add penalty settlement unit tests in packages/domain/src/attendance/penalty-settlement.test.ts
Task T091: Add penalty contract tests in apps/api/tests/contract/attendance-penalties.contract.test.ts
Task T093: Add KPI source unit tests in apps/api/tests/unit/attendance-kpi-source.service.test.ts
Task T094: Add privacy integration tests in apps/api/tests/integration/attendance-privacy.integration.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1 schedules and historical snapshots).
3. Stop and validate US1 independently with its unit, contract, integration and tenant-isolation tests.

### Practical P1 Module Slice

1. Complete US1 schedules.
2. Complete US2 check-in video and late calculation.
3. Complete US3 workflow definitions and decisions for shift-change and late-notice flows.
4. Validate that P1 paths can run without US4/US5 UI or mobile implementation.

### Incremental Delivery

1. US1 adds reliable schedule history.
2. US2 adds authoritative attendance events and late classification.
3. US3 adds approval workflows and idempotent final effects.
4. US4 adds leave/OFF behavior and monthly absence notifications.
5. US5 adds explainable penalties and Module 2 KPI source integration.

### Parallel Team Strategy

1. Team completes Setup and Foundation together.
2. One developer owns domain/contracts, one owns API/repositories, one owns worker/tests.
3. After Foundation, US2 worker tasks and US3 workflow tasks can proceed in parallel as long as shared schema changes are coordinated.

---

## Notes

- `[P]` tasks must not edit the same file at the same time.
- All server time, tenant scope, branch scope, RBAC, audit, idempotency and redaction decisions stay on the backend.
- Do not implement leave balance/accrual, payroll integration, payment gateway integration, AI video scoring, booking queue logic, mobile UI, or a general workflow builder in Module 3.
- Do not start `$speckit-implement` until `$speckit-analyze` reports no unresolved critical issue.

## Requirement Traceability

| Requirement range | Covered by tasks | Primary tests/evidence |
| --- | --- | --- |
| FR-001..FR-006 schedules and schedule snapshots | T029..T040 | `schedule.test.ts`, `attendance-schedules.contract.test.ts`, schedule integration/isolation shells |
| FR-007..FR-013 video policy, acknowledgement, check-in and manual review | T041..T058 | `attendance-checkin.contract.test.ts`, `attendance-video-conversion.test.ts`, check-in/day-close shells |
| FR-014..FR-024 late calculation, late notices and video-vs-late settlement rule | T041..T058, T090..T104 | `time.test.ts`, `late-penalty.test.ts`, `penalty-settlement.test.ts` |
| FR-025..FR-028 versioned penalty policy, settlement and payment transitions | T011..T028, T090..T104 | migration/seed tests, `attendance-penalties.contract.test.ts`, penalty integration shell |
| FR-029..FR-034 approval workflow definitions, decisions and final effects | T059..T073, T086 | `state-machine.test.ts`, `workflows.contract.test.ts`, workflow integration/concurrency/isolation shells |
| FR-035..FR-043 leave, sudden leave, OFF calendar, conflicts, monthly absence and media evidence | T074..T089, T108..T109 | `absence.test.ts`, `attendance-leave.contract.test.ts`, monthly absence/media retention tests |
| FR-044..FR-046 attendance KPI source and action item projections | T101..T104 | `attendance-kpi-source.service.test.ts`, privacy/security regression tests |
| FR-047 seed data | T024, T028, T040, T058, T073, T089 | `timekeeping-seed.integration.test.ts`, `verify-timekeeping-seed.ts` |
| FR-048..FR-049 company/branch OFF and monthly absence threshold | T074..T089 | OFF calendar shell, monthly absence runner test, quickstart scenario evidence |
| CR-001..CR-006 tenant isolation, RBAC, auditability, idempotency, privacy, retention and scale gates | T011..T028, T063, T104..T114 | contract/security/load smoke/typecheck/lint/build/coverage evidence |

## Scope Confirmation

T114 check: Module 3 tasks and implementation remain limited to backend/API/database/worker/contracts/tests for schedules, video attendance, late/leave/OFF, approval workflows, penalties, media retention and KPI source. The task list still excludes mobile UI, booking queue logic, payroll/payment gateway, leave balance/accrual, AI video scoring and a general workflow builder.
