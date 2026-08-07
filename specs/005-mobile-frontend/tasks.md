# Tasks: Mobile Frontend MVP

**Input**: Design documents from `specs/005-mobile-frontend/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/` and
`quickstart.md`

**Tests**: Tests are mandatory under the Adsup Constitution. Story test tasks are written before
their corresponding implementation tasks and must fail for the missing behavior before the task
is considered ready to mark complete.

**Scope**: New React Native TypeScript Expo client in `apps/mobile`. Module 1-4 backend contracts,
PostgreSQL state and workers remain authoritative. No mobile-only business tables, PDF, advanced
OKR hierarchy, weekly OKR check-in, customer self-booking, payroll or payment gateway work.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Expo workspace package, design baseline and native test harness.

- [X] T001 Create the `apps/mobile` Expo TypeScript package, record the exact locked Expo SDK,
  React and React Native versions plus Zustand as the client UI-context store in
  `apps/mobile/package.json` and `pnpm-lock.yaml`, and add `apps/mobile/app.config.ts`,
  `apps/mobile/tsconfig.json` and `apps/mobile/index.ts`.
- [X] T002 Add the mobile workspace scripts for start, test, contract test, integration test, E2E, typecheck, lint and build in `apps/mobile/package.json`.
- [X] T003 [P] Add mobile environment example and runtime configuration adapter in `apps/mobile/.env.example` and `apps/mobile/src/config/runtime-config.ts` without committing secrets.
- [X] T004 [P] Create the mobile visual direction and component inventory in `specs/005-mobile-frontend/design/mobile-direction.md` using the mobile reference and UI/UX guidance.
- [X] T005 Create native design tokens for color, typography, spacing, radii, motion, safe areas and touch targets in `apps/mobile/src/theme/tokens.ts` and `apps/mobile/src/theme/theme.ts`.
- [X] T006 Configure Jest/`jest-expo`, React Native Testing Library and Detox in `apps/mobile/jest.config.js`, `apps/mobile/tests/setup.ts` and `apps/mobile/.detoxrc.js`.
- [X] T007 [P] Configure mobile ESLint, Prettier and TypeScript project references in `apps/mobile/eslint.config.js`, `apps/mobile/.prettierignore` and `apps/mobile/tsconfig.json`.
- [X] T008 [P] Add Expo development-build permissions and deep-link schemes for camera, media library, secure storage and notifications in `apps/mobile/app.config.ts`.
- [X] T009 [P] Add the initial mobile smoke fixture and deterministic provider adapter registry in `apps/mobile/tests/fixtures/mobile-fixture.ts` and `apps/mobile/src/adapters/provider-registry.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared API, session, tenant, privacy, cache and realtime boundaries that
every user story depends on.

**Checkpoint**: No user story implementation may start until T010-T026 pass.

### Foundational tests first

- [X] T010 [P] Add shared OpenAPI/schema compatibility fixtures for Module 1-4 operations in `apps/mobile/tests/contract/module-contract-fixtures.test.ts`.
- [X] T011 [P] Add API client tests for bearer injection, problem parsing, correlation IDs and safe error redaction in `apps/mobile/tests/unit/api-client.test.ts`.
- [X] T012 [P] Add auth-refresh tests for single-flight refresh, rotation, logout and failed-refresh mutation denial in `apps/mobile/tests/unit/session-coordinator.test.ts`.
- [X] T013 [P] Add tenant/branch isolation tests for query keys, request paths, deep links and websocket room changes in `apps/mobile/tests/unit/tenant-context.test.ts`.
- [X] T014 [P] Add idempotency/retry reconciliation tests for repeated mutation intents and stale state conflicts in `apps/mobile/tests/unit/mutation-boundary.test.ts`.
- [X] T015 [P] Add privacy tests proving tokens, PII, signed URLs, object keys and raw media payloads are absent from logs and general cache in `apps/mobile/tests/unit/privacy-policy.test.ts`.
- [X] T016 [P] Add adapter tests for Google, camera, notifications, Socket.io and object storage test doubles in `apps/mobile/tests/unit/provider-adapters.test.ts`.

### Foundational implementation

- [X] T017 Implement the typed authenticated API client, scoped request builder and problem model in `apps/mobile/src/api/api-client.ts`, `apps/mobile/src/api/problem.ts` and `apps/mobile/src/api/request-scope.ts`.
- [X] T018 Implement SecureStore-backed session storage and single-flight refresh/logout coordination in `apps/mobile/src/auth/secure-session-storage.ts` and `apps/mobile/src/auth/session-coordinator.ts`.
- [X] T019 Implement the Google provider interface and local deterministic auth double in `apps/mobile/src/auth/google-provider.ts` and `apps/mobile/src/auth/auth-test-double.ts`.
- [X] T020 Implement tenant membership, branch scope, permission snapshot and context-version management in `apps/mobile/src/tenant/tenant-context.ts` and `apps/mobile/src/tenant/tenant-scope.ts`.
- [X] T021 Implement TanStack Query configuration, scope-aware query keys, sensitive-cache eviction and cancellation on tenant/session change in `apps/mobile/src/storage/query-client.ts` and `apps/mobile/src/storage/cache-policy.ts`.
- [X] T022 Implement mutation idempotency keys, optimistic-concurrency headers/body helpers and server-state reconciliation in `apps/mobile/src/api/mutation-boundary.ts`.
- [X] T023 Implement redacted telemetry and safe structured logging in `apps/mobile/src/observability/safe-telemetry.ts` and `apps/mobile/src/observability/safe-logger.ts`.
- [X] T024 Implement tenant-scoped Socket.io lifecycle, room authorization, event validation and reconnect invalidation in `apps/mobile/src/realtime/socket-client.ts` and `apps/mobile/src/realtime/realtime-provider.ts`.
- [X] T025 Implement reusable loading, empty, error, forbidden, conflict, offline and session-expired state components in `apps/mobile/src/components/async-states/`.
- [X] T026 Implement the guarded Expo Router root and placeholder route groups in `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(auth)/_layout.tsx` and `apps/mobile/app/(tabs)/_layout.tsx`.

---

## Phase 3: User Story 1 - Đăng nhập và chọn workspace an toàn (Priority: P1) 🎯 MVP

**Goal**: Authenticate an internal user, confirm profile data, select an authorized tenant and
branch scope, and prevent foreign-scope access.

**Independent Test**: Use a local auth double to sign in, complete profile confirmation, choose a
seeded tenant/branch, open a guarded screen, expire the session and attempt a foreign tenant or
branch deep link. The app must preserve backend scope and show safe auth/forbidden states.

### Tests for User Story 1 (write first)

- [X] T027 [P] [US1] Add auth/profile/tenant OpenAPI contract tests in `apps/mobile/tests/contract/auth-workspace.contract.test.ts`.
- [X] T028 [P] [US1] Add integration tests for profile confirmation, multi-tenant selection, branch scope and foreign-scope denial in `apps/mobile/tests/integration/auth-workspace.integration.test.ts`.
- [X] T029 [P] [US1] Add accessibility requirements tests for auth, profile and workspace controls in `apps/mobile/tests/accessibility/auth-workspace.a11y.test.tsx`.
- [X] T030 [P] [US1] Add deep-link and session-expiry regression tests in `apps/mobile/tests/unit/auth-deep-links.test.ts`.

### Implementation for User Story 1

- [X] T031 [US1] Implement the sign-in screen and Google/local-provider handoff in `apps/mobile/app/(auth)/sign-in.tsx` and `apps/mobile/src/features/auth/sign-in-model.ts`.
- [X] T032 [US1] Implement profile confirmation and safe incomplete-profile routing in `apps/mobile/app/(auth)/profile-confirmation.tsx` and `apps/mobile/src/features/auth/profile-confirmation.ts`.
- [X] T033 [US1] Implement membership/workspace selection from `/v1/me/tenants` in `apps/mobile/app/(auth)/workspace-selection.tsx` and `apps/mobile/src/features/workspace/workspace-queries.ts`.
- [X] T034 [US1] Implement branch selection and permission-aware scope summary in `apps/mobile/app/(auth)/branch-selection.tsx` and `apps/mobile/src/features/workspace/branch-scope.ts`.
- [X] T035 [US1] Implement guarded navigation, session-expired recovery and safe foreign-scope error routes in `apps/mobile/app/(auth)/_layout.tsx`, `apps/mobile/app/forbidden.tsx` and `apps/mobile/app/session-expired.tsx`.
- [X] T036 [US1] Implement logout, account suspension handling and tenant-switch cache eviction in `apps/mobile/src/features/auth/auth-actions.ts`.
- [X] T037 [US1] Add the US1 device smoke flow for sign-in, workspace selection, branch switch and re-authentication in `apps/mobile/tests/e2e/auth-workspace.e2e.ts`.

**Checkpoint**: US1 is independently demonstrable as the MVP shell and must pass its contract,
integration, accessibility and E2E tests before proceeding.

---

## Phase 4: User Story 2 - Dashboard, KPI và Việc cần hoàn thành (Priority: P1)

**Goal**: Present backend KPI/action-center data, scoped manager summaries, badges and validated
deep links without local business calculations.

**Independent Test**: With the US1 foundation and a seeded tenant, load employee and manager
dashboard data, paginate action items, switch branch scope, receive an action-item event and open a
valid or stale source deep link.

### Tests for User Story 2 (write first)

- [X] T038 [P] [US2] Add Module 2 KPI and action-item contract tests in `apps/mobile/tests/contract/dashboard-action-items.contract.test.ts`.
- [X] T039 [P] [US2] Add dashboard integration tests for employee/manager scope, pagination, open counts and branch filtering in `apps/mobile/tests/integration/dashboard-action-items.integration.test.ts`.
- [X] T040 [P] [US2] Add action-item dedupe and realtime invalidation unit tests in `apps/mobile/tests/unit/action-item-reconciliation.test.ts`.
- [X] T041 [P] [US2] Add Dashboard/action-center accessibility tests for labels, state, focus order and dynamic text in `apps/mobile/tests/accessibility/dashboard.a11y.test.tsx`.

### Implementation for User Story 2

- [X] T042 [US2] Implement the authenticated bottom tab shell with accessible Dashboard/OKR-KPI, Workspace and Chat labels in `apps/mobile/app/(tabs)/_layout.tsx` and `apps/mobile/src/navigation/tab-config.ts`.
- [X] T043 [US2] Implement KPI summary queries and server-value presentation in `apps/mobile/src/features/dashboard/kpi-queries.ts` and `apps/mobile/src/features/dashboard/KpiSummary.tsx`.
- [X] T044 [US2] Implement employee action-center feed, cursor pagination, open count and safe empty/error states in `apps/mobile/app/(tabs)/dashboard.tsx` and `apps/mobile/src/features/action-items/action-item-feed.ts`.
- [X] T045 [US2] Implement manager action-item scope filters and aggregate presentation from the management contract in `apps/mobile/src/features/action-items/managed-action-items.tsx`.
- [X] T046 [US2] Implement the shared validated deep-link resolver and action-item route adapter
  in `apps/mobile/src/navigation/deep-link-resolver.ts` and
  `apps/mobile/src/navigation/action-item-route.ts`; this is the only owner of tenant, branch,
  permission, freshness and mutation validation for action-item, push and native-action intents.
- [X] T047 [US2] Wire `action-item.changed` events to scoped query invalidation and badge reconciliation in `apps/mobile/src/features/action-items/action-item-realtime.ts`.
- [X] T048 [US2] Add Dashboard/action-center navigation and scope integration coverage in `apps/mobile/tests/integration/dashboard-navigation.integration.test.ts`.

---

## Phase 5: User Story 3 - Chấm công video, lịch ca, nghỉ phép và approval (Priority: P1)

**Goal**: Provide scoped attendance, native video check-in, leave/late/shift requests, approval
decisions, penalty ledger and authorized payment-proof flows.

**Independent Test**: Read a schedule and effective policy, acknowledge it, capture and retry a
video upload, submit a versioned leave request, decide it as an authorized manager and view only
the permitted penalty/payment data.

### Tests for User Story 3 (write first)

- [X] T049 [P] [US3] Add Module 3 attendance, workflow and penalty OpenAPI contract tests in `apps/mobile/tests/contract/attendance-workflows.contract.test.ts`.
- [X] T050 [P] [US3] Add media upload state-machine and checksum unit tests in `apps/mobile/tests/unit/attendance-media-upload.test.ts`.
- [X] T051 [P] [US3] Add integration tests for policy acknowledgement, check-in submission and interrupted upload retry in `apps/mobile/tests/integration/attendance-checkin.integration.test.ts`.
- [X] T052 [P] [US3] Add integration tests for full-day, morning-half-day and date-range workflow requests and manager decisions in `apps/mobile/tests/integration/leave-approval.integration.test.ts`.
- [X] T053 [P] [US3] Add tenant/branch/RBAC/privacy regression tests for attendance media, penalty ledger and payment proof in `apps/mobile/tests/integration/attendance-privacy.integration.test.ts`.
- [X] T054 [P] [US3] Add camera, upload, leave-form and penalty accessibility tests in `apps/mobile/tests/accessibility/attendance.a11y.test.tsx`.

### Implementation for User Story 3

- [X] T055 [US3] Implement schedule, off-calendar and effective video-policy queries in `apps/mobile/src/features/attendance/attendance-queries.ts`.
- [X] T056 [US3] Implement policy acknowledgement with policy-version and device metadata handling in `apps/mobile/src/features/attendance/video-policy-acknowledgement.ts`.
- [X] T057 [US3] Implement native camera permission, full-body/work-area capture, preview, cancellation and media cleanup in `apps/mobile/src/media/video-capture.ts` and `apps/mobile/app/attendance/video-capture.tsx`.
- [X] T058 [US3] Implement signed media intent, checksum, progress, interruption, retry, completion and expiry recovery in `apps/mobile/src/media/media-upload-session.ts` and `apps/mobile/src/media/media-upload-transport.ts`.
- [X] T059 [US3] Implement check-in submission with idempotency and server policy/session identifiers in `apps/mobile/src/features/attendance/check-in-actions.ts`.
- [X] T060 [US3] Implement schedule/check-in status screen and late/leave summary in `apps/mobile/app/attendance/index.tsx` and `apps/mobile/src/features/attendance/attendance-summary.tsx`.
- [X] T061 [US3] Implement schema-driven leave, late notice, sudden leave and shift-change request forms using `/workflows/requests` in `apps/mobile/app/approvals/request.tsx` and `apps/mobile/src/features/approvals/request-adapters.ts`.
- [X] T062 [US3] Implement approval request detail, supplemental evidence, approve/reject/request-changes/cancel actions and stale-state recovery in `apps/mobile/app/approvals/[requestId].tsx` and `apps/mobile/src/features/approvals/approval-actions.ts`.
- [X] T063 [US3] Implement penalty settlement ledger, safe payment status display and authorized payment-proof upload in `apps/mobile/app/attendance/penalties.tsx` and `apps/mobile/src/features/attendance/penalty-ledger.ts`.
- [X] T064 [US3] Add US3 device smoke coverage for camera denial, interrupted upload, leave submission and approval decision in `apps/mobile/tests/e2e/attendance-approval.e2e.ts`.

---

## Phase 6: User Story 4 - Booking, dynamic forms và lịch khách (Priority: P1)

**Goal**: Consume published dynamic forms and booking APIs for calendar, customers, conflict
feedback, consent/photo proof, ARRIVED, photo debt, outcome and reschedule.

**Independent Test**: Load a published FormVersion, create a scheduled or walk-in booking within
branch scope, exercise a 60-minute conflict, record consent and proof photo, use ARRIVED, then
handle photo debt, outcome and reschedule with stale-state recovery.

### Tests for User Story 4 (write first)

- [X] T065 [P] [US4] Add Module 4 booking, form, consent, arrival, outcome and reschedule contract tests in `apps/mobile/tests/contract/booking-forms.contract.test.ts`.
- [X] T066 [P] [US4] Add JSON Schema renderer and server-validation bridge unit tests in
  `apps/mobile/tests/unit/dynamic-form-renderer.test.ts` using a named fixture matrix for every
  supported keyword/type, required and invalid values, unsupported keywords and server field/form
  errors; verify unsupported schemas block submit instead of silently dropping fields.
- [X] T067 [P] [US4] Add calendar/customer/booking integration tests for branch scope, cursor paging, walk-in and 60-minute conflicts in `apps/mobile/tests/integration/booking-calendar.integration.test.ts`.
- [X] T068 [P] [US4] Add consent/upload/ARRIVED/photo-debt integration tests for proof media and idempotent retry in `apps/mobile/tests/integration/booking-arrival-proof.integration.test.ts`.
- [X] T069 [P] [US4] Add outcome/reschedule stale-version and reason-version integration tests in `apps/mobile/tests/integration/booking-outcome.integration.test.ts`.
- [X] T070 [P] [US4] Add dynamic form, calendar, customer PII and arrival-flow accessibility tests in `apps/mobile/tests/accessibility/booking.a11y.test.tsx`.

### Implementation for User Story 4

- [X] T071 [US4] Implement published FormVersion fetch, supported JSON Schema renderer, client mirror validation and unsupported-schema state in `apps/mobile/src/forms/form-version-loader.ts`, `apps/mobile/src/forms/json-schema-renderer.tsx` and `apps/mobile/src/forms/form-validation.ts`.
- [X] T072 [US4] Implement version-bound draft storage and eviction for dynamic forms in `apps/mobile/src/forms/form-draft-store.ts`.
- [X] T073 [US4] Implement customer and booking operation adapters with tenant/branch scope and cursor pagination in `apps/mobile/src/features/booking/booking-api.ts`.
- [X] T074 [US4] Implement calendar view, day/branch filters, booking detail and conflict/optimistic-concurrency states in `apps/mobile/app/booking/calendar.tsx`, `apps/mobile/app/booking/[bookingId].tsx` and `apps/mobile/src/features/booking/calendar-model.ts`.
- [X] T075 [US4] Implement scheduled and walk-in booking forms using the versioned form renderer and idempotency boundary in `apps/mobile/app/booking/create.tsx` and `apps/mobile/src/features/booking/booking-actions.ts`.
- [X] T076 [US4] Implement effective customer-photo consent display and append-only consent submission in `apps/mobile/src/features/booking/customer-photo-consent.ts`.
- [X] T077 [US4] Implement authorized customer proof-photo capture/upload and media cleanup in `apps/mobile/src/features/booking/customer-photo-upload.ts`.
- [X] T078 [US4] Implement ARRIVED submission, photo-debt state, tour completion and action-item reconciliation in `apps/mobile/src/features/booking/arrival-actions.ts` and `apps/mobile/src/features/booking/photo-debt.ts`.
- [X] T079 [US4] Implement cancellation reason selection, outcome and reschedule flows with current state/version refresh in `apps/mobile/src/features/booking/outcome-actions.ts` and `apps/mobile/app/booking/outcome.tsx`.
- [X] T080 [US4] Add US4 device smoke coverage for dynamic form submission, conflict, consent, proof photo, ARRIVED and reschedule in `apps/mobile/tests/e2e/booking.e2e.ts`.

---

## Phase 7: User Story 5 - Chat, notification badges và quick actions (Priority: P2)

**Goal**: Provide tenant-scoped chat, push endpoint registration, deduplicated badges, safe deep
links and platform-aware quick actions for arrival proof and cancellation/reschedule.

**Independent Test**: Paginate and send a scoped chat message, reconnect without duplicates,
register a notification endpoint, receive an action-item/booking notification and execute the
validated in-app proof or reason flow.

### Tests for User Story 5 (write first)

- [X] T081 [P] [US5] Add Module 1 chat, notification endpoint and realtime contract tests in `apps/mobile/tests/contract/chat-notifications.contract.test.ts`.
- [X] T082 [P] [US5] Add Socket.io reconnect, event-scope and optimistic-message reconciliation tests in `apps/mobile/tests/unit/chat-realtime.test.ts`.
- [X] T083 [P] [US5] Add notification deduplication, badge and deep-link expiry tests in `apps/mobile/tests/unit/notification-reconciliation.test.ts`.
- [X] T084 [P] [US5] Add quick-action tests proving ARRIVED requires consent/proof media and cancel/reschedule requires current reason/state in `apps/mobile/tests/integration/quick-actions.integration.test.ts`.
- [X] T085 [P] [US5] Add notification privacy and cross-tenant payload rejection tests in `apps/mobile/tests/integration/notification-privacy.integration.test.ts`.
- [X] T086 [P] [US5] Add chat, notification and quick-action accessibility tests in `apps/mobile/tests/accessibility/chat-notifications.a11y.test.tsx`.

### Implementation for User Story 5

- [X] T087 [US5] Implement tenant-scoped channel list, cursor message history and safe message composer in `apps/mobile/app/(tabs)/chat.tsx`, `apps/mobile/src/features/chat/chat-queries.ts` and `apps/mobile/src/features/chat/chat-composer.ts`.
- [X] T088 [US5] Implement Socket.io chat connection, reconnect, event validation, server ordering and optimistic reconciliation in `apps/mobile/src/features/chat/chat-realtime.ts`.
- [X] T089 [US5] Implement notification permission adapter, FCM/APNs endpoint registration/revocation and safe payload parsing in `apps/mobile/src/notifications/notification-registration.ts` and `apps/mobile/src/notifications/notification-payload.ts`.
- [X] T090 [US5] Implement event/effect-key badge aggregation for action items, approvals, photo debt, KPI and booking events in `apps/mobile/src/notifications/badge-store.ts`.
- [X] T091 [US5] Implement the notification deep-link adapter in
  `apps/mobile/src/notifications/deep-link-handler.ts`, delegating all tenant, branch,
  permission, state and expiry reauthorization to the shared resolver from T046.
- [X] T092 [US5] Implement `ARRIVED_PROOF` notification action capability detection and proof-media fallback route in `apps/mobile/src/notifications/arrived-proof-action.ts`.
- [X] T093 [US5] Implement `CANCEL_OR_RESCHEDULE` notification action fallback to the in-app reason/state flow in `apps/mobile/src/notifications/cancel-reschedule-action.ts`.
- [X] T094 [US5] Configure iOS and Android notification categories/action identifiers and unsupported-platform fallback in `apps/mobile/app.config.ts` and `apps/mobile/src/notifications/platform-capabilities.ts`.
- [X] T095 [US5] Add US5 device smoke coverage for chat reconnect, badge dedupe, notification deep links and both quick-action fallbacks in `apps/mobile/tests/e2e/chat-notifications.e2e.ts`.

---

## Phase 8: User Story 6 - Trải nghiệm mobile đáng tin cậy và accessible (Priority: P2)

**Goal**: Make every critical path resilient, privacy-safe and accessible across devices, themes,
dynamic text, permissions, intermittent networking and app lifecycle events.

**Independent Test**: Run the critical-path matrix on small/large phones and tablets with large
text, screen reader, reduced motion, dark mode, denied permissions, offline transitions, session
expiry and unsupported native capabilities; each path must have a recoverable state.

### Tests for User Story 6 (write first)

- [X] T096 [P] [US6] Add component accessibility matrix tests for labels, roles, state, focus order, touch targets, safe areas and dynamic text in `apps/mobile/tests/accessibility/critical-path-matrix.a11y.test.tsx`.
- [X] T097 [P] [US6] Add theme, reduced-motion and tablet layout tests in `apps/mobile/tests/accessibility/theme-layout.a11y.test.tsx`.
- [X] T098 [P] [US6] Add offline, retry, app-background, OS-kill and session-expiry recovery tests in `apps/mobile/tests/integration/mobile-resilience.integration.test.ts`.
- [X] T099 [P] [US6] Add performance-budget tests for dashboard/action center and paginated booking/chat reads in `apps/mobile/tests/integration/mobile-performance.integration.test.ts`.
- [X] T100 [P] [US6] Add native permission and unsupported quick-action capability tests in `apps/mobile/tests/unit/native-capabilities.test.ts`.

### Implementation for User Story 6

- [X] T101 [US6] Implement shared accessible form fields, buttons, labels, focus handling and touch-target primitives in `apps/mobile/src/components/accessibility/`.
- [X] T102 [US6] Implement light/dark theme, dynamic type, reduced-motion preference and responsive phone/tablet tokens in `apps/mobile/src/theme/`.
- [X] T103 [US6] Implement common offline, retry, partial-data, permission-denied and session-expired recovery boundaries in `apps/mobile/src/components/async-states/` and `apps/mobile/src/api/recovery-policy.ts`.
- [X] T104 [US6] Implement app lifecycle upload pause/resume, stale-intent reauthorization and sensitive-data cleanup in `apps/mobile/src/media/app-lifecycle-upload.ts` and `apps/mobile/src/storage/sensitive-cache-eviction.ts`.
- [X] T105 [US6] Implement safe telemetry for request failures, refresh, upload, websocket reconnect and native capability fallback in `apps/mobile/src/observability/mobile-metrics.ts`.
- [X] T106 [US6] Add the canonical Detox device matrix configuration in
  `apps/mobile/.detoxrc.js` for Android/iOS, phone/tablet, light/dark and accessibility smoke,
  plus the scenario in `apps/mobile/tests/e2e/accessibility-smoke.e2e.ts`.
- [ ] T107 [US6] Add a full critical-path E2E journey against the real seeded Module 1-4 API in `apps/mobile/tests/e2e/mvp-critical-path.e2e.ts`.

---

## Phase 9: Polish and Cross-Cutting Release Gate

**Purpose**: Close traceability, documentation, security and release verification after the desired
user stories are complete.

- [X] T108 [P] Complete FR/CR/SC-to-test traceability in `specs/005-mobile-frontend/traceability.md`.
      All 26 FR, 6 CR and 10 SC are now mapped. FR-026 and CR-005 are recorded as REVIEW rather
      than PASS, and FR-025, SC-001, SC-003, SC-010 stay BLOCKED on the native-device tasks.
- [X] T109 [P] Add contract compatibility snapshots for all consumed Module 1-4 OpenAPI operations in `apps/mobile/tests/contract/module-compatibility.contract.test.ts`.
- [X] T110 [P] Add a privacy/RBAC review record for tenant isolation, signed media, retention, consent, deep links, logs and local eviction in `specs/005-mobile-frontend/privacy-review.md`.
- [ ] T111 Run mobile unit, contract, integration, accessibility and E2E suites and record commands/results in `specs/005-mobile-frontend/verification.md`.
- [X] T112 Run mobile typecheck, lint, format check and Expo development/production build checks; record results in `specs/005-mobile-frontend/verification.md`.
- [X] T113 Run backend API contract, migration and relevant integration tests together with the mobile compatibility suite in `specs/005-mobile-frontend/verification.md`.
- [ ] T114 Validate every `quickstart.md` scenario with local PostgreSQL, API, worker and Expo development build in `specs/005-mobile-frontend/verification.md`.
- [X] T115 Update `README.md` with the verified mobile local setup, device/emulator requirements, scripts and provider-double boundaries.
- [X] T116 Update `docs/architecture/operations.md` with mobile session, media, notification, realtime, privacy and troubleshooting guidance.
- [X] T117 Review the final dependency gate against `spec.md`, `plan.md`, `tasks.md`, `contracts/` and `quickstart.md` and record unresolved gaps in `specs/005-mobile-frontend/verification.md`.

---

## Phase 10: Convergence Remediation

**Purpose**: Close the measurable success-criteria, native quick-action, resolver ownership and
test-runner gaps found during cross-artifact analysis. These tasks remain implementation work and
must not be marked complete until their named verification passes.

- [ ] T118 [P] [US1] Add a timed login/workspace E2E measurement in
  `apps/mobile/tests/e2e/auth-workspace-performance.e2e.ts`; execute 20 seeded runs per supported
  device profile from the initial sign-in state, assert the first attempt completes login and
  workspace selection without manual tenant/branch re-entry in under 60 seconds for at least
  19/20 runs, and record the denominator, per-run result and aggregate in
  `specs/005-mobile-frontend/verification.md`.
- [ ] T119 [P] [US2] Add a timed Dashboard/action-center E2E measurement in
  `apps/mobile/tests/e2e/dashboard-performance.e2e.ts`; execute a 20-run sample for each supported
  device profile and each data-ready profile `COLD_START`, `WARM_CACHE` and `DEGRADED_NETWORK`,
  assert at least 19/20 runs per profile show first actionable data in under 3 seconds, and record
  the profile, denominator, per-run result and aggregate in
  `specs/005-mobile-frontend/verification.md`.
- [X] T120 [P] [US6] Add the SC-009 recovery-matrix test in
  `apps/mobile/tests/integration/recovery-rate.integration.test.ts`; cover injected failure classes
  `API_ERROR`, `SESSION_EXPIRED`, `PERMISSION_DENIED` and `NETWORK_INTERRUPTION` across the
  critical paths, define the denominator as every attempted injected-failure scenario (minimum 20
  across platform and network profiles), count recovery only when the UI reaches a safe retry,
  re-auth or refreshed server-state outcome without duplicate business action, assert at least 95%,
  and record numerator/denominator in `specs/005-mobile-frontend/verification.md`.
- [X] T121 [P] [US5] Add failing native lock-screen action handler tests for iOS and Android
  `ARRIVED_PROOF` and `CANCEL_OR_RESCHEDULE` in
  `apps/mobile/tests/integration/native-quick-actions.integration.test.ts` and
  `apps/mobile/tests/e2e/native-quick-actions.e2e.ts`; verify platform action identifiers are
  normalized before they reach the shared resolver and both fallback flows (depends on T092-T094).
- [X] T122 [US5] Implement the native lock-screen action response handler in
  `apps/mobile/src/notifications/native-action-handler.ts` and its platform adapter wiring in
  `apps/mobile/src/notifications/platform-capabilities.ts`, mapping `ARRIVED_PROOF` to the
  consent/proof-media flow from T092 and `CANCEL_OR_RESCHEDULE` to the reason/state flow from T093,
  then delegating validation to the shared resolver from T046 without duplicating business logic
  (depends on T092-T094 and T121).
- [X] T123 [US6] Align all Detox commands, scripts and documentation with the single canonical
  config `apps/mobile/.detoxrc.js`; update the accessibility smoke wiring in
  `apps/mobile/tests/e2e/accessibility-smoke.e2e.ts` and remove any competing Detox config path
  from mobile artifacts (depends on T106).
- [X] T124 Update `specs/005-mobile-frontend/traceability.md` with SC-001, SC-003 and SC-009
  measurement ownership, denominator/result fields, native handler test coverage, explicit FR-006
  filters and the shared deep-link resolver ownership (depends on T118-T123).

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001-T009; no dependency on user stories.
- **Foundational (Phase 2)**: T010-T026; depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: T027-T037; depends on Foundational and is the recommended MVP checkpoint.
- **US2 (Phase 4)**: T038-T048; depends on Foundational and may run beside US1 after the shared shell is available.
- **US3 (Phase 5)**: T049-T064; depends on Foundational and consumes Module 3 contracts; it may run beside US2.
- **US4 (Phase 6)**: T065-T080; depends on Foundational and consumes Module 4 contracts; it may run beside US2/US3.
- **US5 (Phase 7)**: T081-T095; depends on Foundational and the booking/arrival operation adapters needed by quick actions, especially T073-T079, but remains independently testable with contract fixtures.
- **US6 (Phase 8)**: T096-T107; depends on all critical screens and shared flows selected for the MVP.
- **Polish (Phase 9)**: T108-T117; depends on all desired user stories and their verification results.
- **Convergence Remediation (Phase 10)**: T118-T124; depends on the relevant story tasks and
  Phase 9 artifacts. T121 depends on the existing quick-action flows/configuration in T092-T094;
  T122 depends on T092-T094 and the failing native-handler tests in T121; T123 depends on T106;
  T124 is the final traceability task.

### User Story Completion Order

1. US1 provides the first independently demonstrable authentication/workspace MVP.
2. US2, US3 and US4 can proceed in parallel after Foundational when staffed separately; their API contracts are already stable.
3. US5 follows the booking/arrival adapters for real quick actions, while chat/notification infrastructure can be developed in parallel.
4. US6 hardens all selected stories and is not a substitute for story-level tests.

### Within Each User Story

- Write contract/unit/integration/accessibility tests first and demonstrate the missing behavior before implementation.
- Implement adapters and data boundaries before screens; screens before E2E wiring.
- Keep tenant, branch, permission, idempotency, version and privacy behavior in the owning adapter, not only in UI components.
- Run targeted verification after each logical group and mark the task only when its verification passes.

## Parallel Opportunities

- **Setup**: T003-T004, T007-T009 can run in parallel after the package scaffold T001-T002.
- **Foundational**: T010-T016 can run in parallel; T017-T026 then integrate those boundaries in dependency order.
- **US1 tests**: T027-T030 can run in parallel; implementation follows T031-T036, with T037 last.
- **US2 tests**: T038-T041 can run in parallel; T043-T047 can split by feature after T042.
- **US3 tests**: T049-T054 can run in parallel; capture/upload and workflow/ledger work can split after T055.
- **US4 tests**: T065-T070 can run in parallel; form/booking and consent/arrival work can split after T071/T073.
- **US5 tests**: T081-T086 can run in parallel; chat and notification work can split after T087/T089.
- **US6 tests**: T096-T100 can run in parallel; shared accessibility and lifecycle work can split after T101/T102.
- **Polish**: T108-T110 can run in parallel before the verification sequence T111-T117.
- **Convergence remediation**: T118-T120 can start in parallel after their story prerequisites;
  T121 follows T092-T094, T122 follows T121, T123 follows T106, and T124 follows T118-T123.

## Parallel Example: User Story 4

```text
Task T065: Module 4 contract tests in apps/mobile/tests/contract/booking-forms.contract.test.ts
Task T066: Dynamic form renderer tests in apps/mobile/tests/unit/dynamic-form-renderer.test.ts
Task T067: Calendar/conflict integration tests in apps/mobile/tests/integration/booking-calendar.integration.test.ts
Task T068: Consent/arrival integration tests in apps/mobile/tests/integration/booking-arrival-proof.integration.test.ts
Task T070: Booking accessibility tests in apps/mobile/tests/accessibility/booking.a11y.test.tsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001-T009 Setup.
2. Complete T010-T026 Foundational; this is the blocking security and API boundary.
3. Complete T027-T037 US1.
4. Stop and validate login, profile, tenant/workspace, branch scope, session expiry and foreign-scope denial.
5. Demo the authenticated mobile shell before adding business modules.

### Incremental Delivery

1. Add US2 dashboard/action center and validate KPI deep links.
2. Add US3 attendance/leave/approval/penalty and validate media privacy.
3. Add US4 booking/forms/arrival proof and validate conflicts/consent/photo debt.
4. Add US5 chat/notifications/quick actions and validate reconnect/dedupe/fallbacks.
5. Add US6 accessibility/resilience, then complete Phase 9 release verification.
6. Complete Phase 10 measurement, native-handler, resolver and Detox convergence remediation.

### Notes

- `[P]` means separate files and no dependency on an incomplete task.
- `[USn]` maps a task to the corresponding story from `spec.md`.
- Every task has an exact repository path and a sequential ID.
- No task authorizes a backend migration or a new mobile-only source of truth.

## Phase 11: Convergence

- [X] T125 Complete the attendance video check-in screen end-to-end with media upload intent,
  checksum/progress, cancel/retry, upload completion and check-in submission from
  `apps/mobile/app/attendance/video-capture.tsx`, using the existing media/check-in adapters and
  preserving tenant scope, policy/session identifiers and idempotency per FR-008 and SC-005
  (partial)
- [X] T126 Expand the dynamic form renderer and validation bridge to the full MVP-supported
  JSON Schema and `uiSchema` subset, including `additionalProperties`, `title`, `description`,
  `string|number|integer|boolean|array`, `enum`, `format`, `pattern`, length/range/item limits,
  unsupported-schema blocking and server field/form validation display in
  `apps/mobile/src/forms/json-schema-renderer.tsx`, `apps/mobile/src/forms/form-validation.ts`
  and related booking form tests per FR-010 and SC-004 (partial)
- [X] T127 Complete approval request detail by loading current request state, showing supplemental
  evidence, supporting approve/reject/request-changes/cancel actions, passing expected state
  version/idempotency and rendering stale-state recovery in
  `apps/mobile/app/approvals/[requestId].tsx` and
  `apps/mobile/src/features/approvals/approval-actions.ts` per FR-013 and US3/AC3-4 (partial)
- [X] T128 Complete the booking ARRIVED proof flow in-app by guiding the user through effective
  consent, authorized proof-photo capture/upload/completion, latest booking state refresh,
  ARRIVED submission and photo-debt/action-item reconciliation from
  `apps/mobile/app/booking/[bookingId].tsx` and the existing booking media adapters per FR-011,
  FR-017 and US4/AC4 (partial)
- [X] T129 Wire chat pagination, unread count and real notification badge aggregation into the
  visible Chat/Notifications UI, ensuring reconnect and duplicate deliveries do not duplicate
  messages, badges or effects in `apps/mobile/app/(tabs)/chat.tsx`,
  `apps/mobile/app/notifications.tsx` and `apps/mobile/src/notifications/badge-store.ts` per
  FR-015, FR-016 and US5/AC1-2 (partial)
- [X] T130 Add a runtime theme/provider boundary so supported light/dark/accessibility launch
  profiles select semantic theme values instead of screens importing fixed light tokens directly;
  cover dynamic text and reduced-motion safe layout behavior across shared primitives and critical
  screens per FR-022 and US6/AC3 (partial)

## Phase 12: Convergence

- [X] T131 Restore or intentionally update the Chat/Notifications accessibility contract so the
  visible chat message region and notification badge region are discoverable by the labels asserted
  in `apps/mobile/tests/accessibility/chat-notifications.a11y.test.tsx`; rerun full mobile Jest and
  keep `corepack pnpm --filter @adsup/mobile test` green per FR-015, FR-016, SC-008 and FR-025
  (partial)
- [ ] T132 Replace the placeholder SC-001 login/workspace performance harness in
  `apps/mobile/tests/e2e/auth-workspace-performance.e2e.ts` with 20 real seeded Detox runs per
  supported device profile, assert at least 19/20 complete under 60 seconds and record the
  denominator/results in `specs/005-mobile-frontend/verification.md` per SC-001 (partial)
- [ ] T133 Replace the placeholder SC-003 Dashboard/action-center performance harness in
  `apps/mobile/tests/e2e/dashboard-performance.e2e.ts` with real cold-start, warm-cache and
  degraded-network Detox measurements, assert at least 19/20 runs per profile show actionable data
  under 3 seconds and record the denominator/results in `specs/005-mobile-frontend/verification.md`
  per SC-003 (partial)
- [X] T134 Replace the placeholder native quick-action E2E harness in
  `apps/mobile/tests/e2e/native-quick-actions.e2e.ts` with iOS/Android coverage for
  `ARRIVED_PROOF` and `CANCEL_OR_RESCHEDULE`, proving both lock-screen/native responses normalize
  through the shared resolver and fall back to the authenticated in-app flows per FR-017, FR-020
  and SC-007 (partial)
- [ ] T135 Complete the final native release verification by running and recording the Expo
  development/production build checks, canonical Detox matrix, combined Module 1-4 backend
  compatibility suite and every quickstart scenario with PostgreSQL, API, worker and Expo
  development build in `specs/005-mobile-frontend/verification.md` per SC-010 and Phase 9
  verification tasks (partial)
