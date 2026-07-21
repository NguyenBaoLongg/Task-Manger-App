---
description: "Dependency-ordered implementation tasks for Adsup Module 1"
---

# Tasks: Nền tảng SaaS đa tenant

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Mandatory under Adsup Constitution. Test tasks precede the implementation they cover.

**Organization**: Setup and foundational gates first, then one phase per independently testable user story.

## Phase 1: Setup

**Purpose**: Initialize the TypeScript/pnpm monorepo and shared quality tooling.

- [X] T001 Create root workspace metadata and scripts in `package.json` and `pnpm-workspace.yaml`
- [X] T002 [P] Configure ESM TypeScript project references in `tsconfig.base.json` and `tsconfig.json`
- [X] T003 [P] Configure ESLint flat config and Prettier in `eslint.config.js`, `.prettierrc.json`, and `.prettierignore`
- [X] T004 [P] Add safe repository and container ignore rules in `.gitignore` and `.dockerignore`
- [X] T005 [P] Add validated, secret-free local configuration examples in `.env.example`
- [X] T006 Create deployable workspace manifests in `apps/api/package.json` and `apps/worker/package.json`
- [X] T007 [P] Create shared workspace manifests in `packages/config/package.json`, `packages/contracts/package.json`, and `packages/domain/package.json`
- [X] T008 [P] Create persistence/testing workspace manifests in `packages/database/package.json` and `packages/testing/package.json`
- [X] T009 Configure root Vitest projects and coverage defaults in `vitest.config.ts`
- [X] T010 Add root contract-copy/validation entry point in `packages/contracts/src/index.ts`

**Checkpoint**: Workspace commands resolve and no package has imported downstream business logic.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish schema, tenant context, errors, adapters, audit/idempotency and HTTP composition.

**⚠️ CRITICAL**: No user-story implementation starts before this phase passes.

### Foundational tests first

- [X] T011 [P] Add configuration parsing/redaction tests in `packages/config/src/config.test.ts`
- [X] T012 [P] Add tenant-context, problem-error and permission-policy unit tests in `packages/domain/src/foundation.test.ts`
- [X] T013 [P] Add migration shape and three-run seed assertions in `tests/migration/foundation.migration.test.ts`

### Foundational implementation

- [X] T014 Implement all global/root and tenant-owned Prisma entities, enums, composite tenant keys and indexes in `packages/database/prisma/schema.prisma`
- [X] T015 Generate the reviewed initial PostgreSQL migration with non-Prisma CHECK constraints in `packages/database/prisma/migrations/202607190001_foundation/migration.sql`
- [X] T016 Implement deterministic permission catalog and Module 1 “Công ty TNHH ABC” seed in `packages/database/prisma/seed.ts`
- [X] T017 Implement Prisma 7 adapter/client lifecycle and transaction types in `packages/database/src/client.ts`
- [X] T018 Implement Zod environment parsing and secret-safe config projection in `packages/config/src/index.ts`
- [X] T019 Implement domain IDs, clock, tenant context, problem codes and safe serialization in `packages/domain/src/foundation.ts`
- [X] T020 [P] Define Google, object storage, push, realtime, audit, idempotency and repository ports in `packages/domain/src/ports.ts`
- [X] T021 [P] Implement fake Google, in-memory object storage/push, deterministic clock and ID helpers in `packages/testing/src/index.ts`
- [X] T022 Implement Express app composition, correlation, JSON limits, problem handler and route registration in `apps/api/src/app.ts`
- [X] T023 Implement JWT/session authentication and tenant-context middleware boundaries in `apps/api/src/http/middleware/auth.ts`
- [X] T024 Implement tenant/account idempotency and append-only audit repositories/services in `packages/database/src/governance.ts`
- [X] T025 Implement structured logging, metrics counters, liveness/readiness and dependency probes in `apps/api/src/observability/index.ts`

**Checkpoint**: Prisma schema/migration validate, unit tests pass, and an empty API exposes safe health/problem contracts.

---

## Phase 3: User Story 1 — Đăng nhập và vào đúng doanh nghiệp (Priority: P1) 🎯 MVP

**Goal**: Google identity, mandatory name confirmation, revocable tokens, tenant creation/listing and invitation acceptance.

**Independent Test**: A fake Google account completes onboarding, creates a tenant, joins a second tenant, retries safely and cannot cross tenant boundaries.

### Tests for User Story 1

- [X] T026 [P] [US1] Add Google/profile/refresh/logout contract tests in `apps/api/tests/contract/auth.contract.test.ts`
- [X] T027 [P] [US1] Add tenant creation/list and invitation contract tests in `apps/api/tests/contract/tenants.contract.test.ts`
- [X] T028 [P] [US1] Add token rotation/replay and suspended-account unit tests in `apps/api/tests/unit/auth.service.test.ts`
- [X] T029 [US1] Add tenant creation, invite concurrency, duplicate membership and cross-tenant integration tests in `apps/api/tests/integration/onboarding.integration.test.ts`

### Implementation for User Story 1

- [X] T030 [P] [US1] Implement production Google verifier and fake-mode factory in `apps/api/src/modules/auth/google-verifier.ts`
- [X] T031 [US1] Implement access JWT, opaque rotating refresh session and replay-family revocation in `apps/api/src/modules/auth/token-service.ts`
- [X] T032 [US1] Implement Google login, mandatory profile confirmation and session lifecycle service in `apps/api/src/modules/auth/auth-service.ts`
- [X] T033 [US1] Implement `/v1/auth/*`, `/v1/me` and notification-safe auth responses in `apps/api/src/modules/auth/auth-routes.ts`
- [X] T034 [US1] Implement atomic tenant bootstrap with owner membership, system roles and general channel in `apps/api/src/modules/tenants/tenant-service.ts`
- [X] T035 [US1] Implement invitation token hashing, expiry/revocation/use locking and idempotent acceptance in `apps/api/src/modules/tenants/invitation-service.ts`
- [X] T036 [US1] Implement `/v1/tenants`, `/v1/me/tenants`, tenant detail and invite routes in `apps/api/src/modules/tenants/tenant-routes.ts`
- [X] T037 [US1] Implement tenant/auth Prisma repositories with tenant-safe selectors in `packages/database/src/auth-tenants.repository.ts`
- [X] T038 [US1] Add US1 OpenAPI operation/schema conformance checks in `packages/contracts/src/openapi.test.ts`
- [X] T039 [US1] Document fake Google and token-rotation local behavior in `docs/architecture/authentication.md`

**Checkpoint**: US1 contract/integration tests pass independently and establish a valid owner workspace.

---

## Phase 4: User Story 2 — Quản trị cơ cấu và quyền hạn (Priority: P1)

**Goal**: Branch/department/position, effective assignments, custom roles and branch-scoped bindings with last-owner safety.

**Independent Test**: Two tenants and multiple branches prove a manager can act only in granted scope; assignment alone grants no management permission.

### Tests for User Story 2

- [X] T040 [P] [US2] Add organization and assignment HTTP contract tests in `apps/api/tests/contract/organization.contract.test.ts`
- [X] T041 [P] [US2] Add RBAC permission-matrix and last-owner unit tests in `apps/api/tests/unit/authorization.service.test.ts`
- [X] T042 [US2] Add nested-ID and branch/tenant negative isolation integration matrix in `apps/api/tests/integration/rbac-isolation.integration.test.ts`

### Implementation for User Story 2

- [X] T043 [US2] Implement permission evaluation for tenant/branch scope and effective role bindings in `packages/domain/src/authorization.ts`
- [X] T044 [US2] Implement branch, department, position and effective assignment service in `apps/api/src/modules/organization/organization-service.ts`
- [X] T045 [US2] Implement custom role, permission binding, membership update and last-owner service in `apps/api/src/modules/rbac/rbac-service.ts`
- [X] T046 [US2] Implement organization and assignment routes from OpenAPI in `apps/api/src/modules/organization/organization-routes.ts`
- [X] T047 [US2] Implement membership/role/binding routes from OpenAPI in `apps/api/src/modules/rbac/rbac-routes.ts`
- [X] T048 [US2] Implement tenant-composite organization/RBAC repositories and concurrency checks in `packages/database/src/organization-rbac.repository.ts`
- [X] T049 [US2] Document permission catalog, system roles and scope matrix in `docs/architecture/rbac.md`

**Checkpoint**: Authorization matrix and cross-tenant/branch negative tests pass; owner invariant cannot be violated.

---

## Phase 5: User Story 3 — Tạo và nộp biểu mẫu động có phiên bản (Priority: P2)

**Goal**: Publish immutable JSON Schema 2020-12 versions and persist validated tenant-scoped submissions.

**Independent Test**: Publish two versions, reject invalid payload atomically and retain version 1 on old submissions.

### Tests for User Story 3

- [X] T050 [P] [US3] Add supported field vocabulary and strict JSON Schema unit tests in `apps/api/tests/unit/form-validator.test.ts`
- [X] T051 [P] [US3] Add form template/publish/submission contract tests in `apps/api/tests/contract/forms.contract.test.ts`
- [X] T052 [US3] Add concurrent publication, immutable history and foreign-version integration tests in `apps/api/tests/integration/forms.integration.test.ts`

### Implementation for User Story 3

- [X] T053 [US3] Implement Ajv 2020 strict schema compilation and field-error mapping in `apps/api/src/modules/forms/form-validator.ts`
- [X] T054 [US3] Implement template creation, transactional publication and immutable submission service in `apps/api/src/modules/forms/form-service.ts`
- [X] T055 [US3] Implement tenant-safe form/version/submission repositories in `packages/database/src/forms.repository.ts`
- [X] T056 [US3] Implement form template, publish and submission routes from OpenAPI in `apps/api/src/modules/forms/form-routes.ts`

**Checkpoint**: Form schemas and submissions are validated, version-stable, audited and tenant-isolated.

---

## Phase 6: User Story 4 — Trao đổi và nhận thông báo đúng phạm vi (Priority: P2)

**Goal**: Tenant/channel-authorized chat, persisted idempotent messages, realtime delivery and self-owned push endpoints.

**Independent Test**: Two authorized clients receive one persisted message under retry; an outsider/revoked member cannot join, read or send.

### Tests for User Story 4

- [X] T057 [P] [US4] Add channel/message and notification endpoint contract tests in `apps/api/tests/contract/chat-notifications.contract.test.ts`
- [X] T058 [P] [US4] Add message idempotency and author snapshot unit tests in `apps/api/tests/unit/chat.service.test.ts`
- [X] T059 [US4] Add Socket.IO join/reconnect/revocation and cross-tenant room integration tests in `apps/api/tests/integration/realtime.integration.test.ts`

### Implementation for User Story 4

- [X] T060 [US4] Implement channel membership, cursor listing and persisted-message service in `apps/api/src/modules/chat/chat-service.ts`
- [X] T061 [US4] Implement channel/message REST routes from OpenAPI in `apps/api/src/modules/chat/chat-routes.ts`
- [X] T062 [US4] Implement Socket.IO authenticated gateway and tenant/channel room derivation in `apps/api/src/realtime/socket-gateway.ts`
- [X] T063 [P] [US4] Implement Redis Streams production backplane and in-memory fallback factory in `apps/api/src/realtime/backplane.ts`
- [X] T064 [US4] Implement self-owned notification endpoint registration/revocation and Noop push port usage in `apps/api/src/modules/notifications/notification-routes.ts`
- [X] T065 [US4] Implement tenant-safe chat and global endpoint repositories in `packages/database/src/chat-notifications.repository.ts`

**Checkpoint**: REST/realtime contracts pass, retries create one message, and revoked/foreign memberships receive no channel data.

---

## Phase 7: User Story 5 — Quản lý media và audit nền tảng (Priority: P2)

**Goal**: Authorized signed media lifecycle plus redacted append-only audit query.

**Independent Test**: Authorized actor completes an upload once and receives a short-lived download; foreign actor receives no URL/metadata; privileged audit query explains the transition.

### Tests for User Story 5

- [X] T066 [P] [US5] Add object-storage adapter signing/head contract tests in `apps/api/tests/unit/object-storage.test.ts`
- [X] T067 [P] [US5] Add media and audit HTTP contract tests in `apps/api/tests/contract/media-audit.contract.test.ts`
- [X] T068 [US5] Add media completion retry, checksum mismatch, source authorization and cross-tenant integration tests in `apps/api/tests/integration/media-audit.integration.test.ts`

### Implementation for User Story 5

- [X] T069 [US5] Implement S3-compatible presigned PUT/GET and HEAD metadata adapter in `apps/api/src/modules/media/s3-object-storage.ts`
- [X] T070 [US5] Implement upload-intent, object verification, lifecycle and download authorization service in `apps/api/src/modules/media/media-service.ts`
- [X] T071 [US5] Implement media intent/complete/download routes from OpenAPI in `apps/api/src/modules/media/media-routes.ts`
- [X] T072 [US5] Implement media tenant/source repository and retention metadata in `packages/database/src/media.repository.ts`
- [X] T073 [US5] Implement redaction policy for secrets, tokens, signed URLs and oversized JSON in `packages/domain/src/redaction.ts`
- [X] T074 [US5] Implement filtered cursor audit query service/route in `apps/api/src/modules/audit/audit-routes.ts`
- [X] T075 [US5] Add immutable audit repository guards and target indexes in `packages/database/src/audit.repository.ts`

**Checkpoint**: Media and audit requirements pass with in-memory storage; S3 adapter contract needs no live credential.

---

## Phase 8: Polish & Cross-Cutting Gates

**Purpose**: Close operational, documentation, migration, contract, load and full verification gates.

- [X] T076 [P] Create worker composition shell with config, logging and readiness in `apps/worker/src/index.ts`
- [X] T077 [P] Add OpenAPI 3.1 parse/reference/operation coverage validation in `packages/contracts/src/openapi-validation.test.ts`
- [X] T078 [P] Add safe Docker/PostgreSQL production example in `docker-compose.example.yml`
- [X] T079 Add Prisma local database helper and deterministic migration scripts in `scripts/prisma-dev.mjs`
- [X] T080 Add k6 HTTP/realtime smoke and target profiles in `tests/load/foundation.k6.js`
- [X] T081 Add secret scanning, dependency/provider failure and problem-redaction regression tests in `apps/api/tests/integration/security-regression.integration.test.ts`
- [X] T082 Validate and document migration rollback/restore/runbook boundaries in `docs/architecture/operations.md`
- [X] T083 Update root developer commands and Module 1 architecture overview in `README.md`
- [X] T084 Run and record format, lint, typecheck, unit, contract, integration, migration, seed, build and load-smoke evidence in `specs/001-multitenant-foundation/verification.md`
- [X] T085 Execute every scenario in `specs/001-multitenant-foundation/quickstart.md` and record deviations/fixes in `specs/001-multitenant-foundation/verification.md`

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 Setup
  -> Phase 2 Foundation
      -> US1 Identity/Tenant (P1)
          -> US2 Organization/RBAC (P1)
              -> US3 Forms (P2)
              -> US4 Chat/Notifications (P2)
              -> US5 Media/Audit (P2)
                  -> Phase 8 Cross-Cutting Gates
```

- US1 depends on the foundation because it creates tenant context and owner role data.
- US2 depends on US1's membership/session/tenant bootstrap contracts.
- US3, US4 and US5 depend on US2 authorization but not on each other; this implementation
  still executes them sequentially because the repository has one active feature and no delegated agents.
- Phase 8 starts only after every selected story checkpoint passes.

### Within each user story

1. Contract/unit/integration tests are written first and observed failing for the missing behavior.
2. Domain/service logic precedes HTTP/realtime delivery when both touch the same behavior.
3. Persistence uses tenant-aware repository methods; controller code never queries Prisma directly.
4. Story checkpoint commands pass before the next story begins.

## Parallel Opportunities

- T002–T005 and T007–T008 affect independent setup files.
- T011–T013 define independent foundational tests; T020–T021 define independent ports/fakes.
- Test files marked `[P]` within each story can be authored independently before implementation.
- T063 is isolated from T060–T062 behind the realtime port after its contract exists.
- T076–T078 are independent polish files.
- Execution in this Codex task remains sequential unless the user explicitly requests delegation.

## Implementation Strategy

### First usable slice

Complete Phase 1, Phase 2 and US1, then validate onboarding/tenant isolation independently.
This is a security foundation checkpoint, not permission to start Module 2.

### Incremental completion

1. Add US2 and lock the authorization matrix.
2. Add US3 dynamic-form substrate.
3. Add US4 chat/notification endpoints.
4. Add US5 signed media/audit query.
5. Pass Phase 8 and run `speckit-converge` until no work remains.

## Format Validation

- Every implementation item uses `- [ ] T### [P?] [US?] Description with exact file path`.
- Setup/foundation/polish tasks have no story label; user-story tasks have exactly one.
- IDs are sequential T001–T085 with no duplicate or gap.

## Phase 9: Convergence Remediation

**Purpose**: Close implementation gaps found by `speckit-converge` after the first full build.

- [X] T086 Reconcile invite acceptance, membership update, form submission, chat bounds and notification statuses with the published OpenAPI contract in `apps/api/src/modules/` and `apps/api/tests/contract/`
- [X] T087 Enforce and replay every OpenAPI-required Idempotency-Key with request fingerprint conflict detection for account and tenant mutations in `packages/database/src/governance.ts` and all mutation routes
- [X] T088 Persist redacted audit/history for login security, invitation, membership/RBAC, assignment, form publication and media transitions, atomically for critical transactions, in `packages/database/src/` and related services
- [X] T089 Move last-owner validation and membership transition into a serializable repository transaction with concurrent integration coverage in `packages/database/src/organization-rbac.repository.ts`
- [X] T090 Implement opaque cursor pagination for memberships, messages and audit events, including audit `targetId`, in repositories and routes
- [X] T091 Enforce media source authorization and owner/scope checks before completion or signed download in `apps/api/src/modules/media/`
- [X] T092 Create an initial form draft and require submissions to name the exact published immutable version in `packages/database/src/forms.repository.ts` and `apps/api/src/modules/forms/`
- [X] T093 Add live-PostgreSQL concurrency, idempotency, nested foreign-ID and provider-failure integration coverage in `apps/api/tests/integration/`
- [X] T094 Expand OpenAPI conformance tests to assert required idempotency headers, request field names, response statuses and cursor contracts for all 40 operations in `packages/contracts/src/openapi-validation.test.ts`
- [X] T095 Re-run every quality/acceptance gate and update `specs/001-multitenant-foundation/verification.md` with convergence evidence

**Convergence Checkpoint**: Module 1 is complete only when T086–T095 are checked and a second
`speckit-converge` pass finds no remaining implementation work.

## Phase 10: Convergence

- [X] T096 Implement organization-unit lifecycle transitions, effective-date assignment queries and inactive/cross-tenant unit validation per FR-007, FR-009 and US2/AC2 (partial)
- [X] T097 Reconcile custom-role requests and responses to OpenAPI `permissionCodes`, validate published permission codes and return role permission codes per FR-011 (contradicts)
- [X] T098 Persist creator/requested channel memberships atomically, disallow client-created general channels and validate Socket.IO message inputs per FR-016 and US4/AC1–2 (partial)
- [X] T099 Add fingerprinted encrypted account idempotency to profile confirmation, refresh and logout while retaining refresh-replay security per FR-022 and CR-003 (missing)
- [X] T100 Add audited immutable form-version retirement and template archival transitions with contract coverage per FR-013 and US3/AC4 (missing)
- [X] T101 Make invitation acceptance safe for existing members and concurrent different invitations without duplicate membership or raw database errors per FR-005 and US1/AC5 (partial)
- [X] T102 Record notification endpoint first/last use and expose active recipient endpoint selection only through the self-owned repository boundary per FR-017 and US4/AC4 (partial)
- [X] T103 Add request duration/status, authorization denial, idempotency replay, realtime connection and adapter-failure telemetry without sensitive labels per FR-025 and plan observability decisions (partial)
- [X] T104 Expand executable HTTP conformance coverage across the published operations for success, validation, authentication, authorization, idempotency/conflict and safe errors per SC-006 and Constitution V (missing)
- [X] T105 Require and audit reasons plus redacted before/after history for new privileged lifecycle transitions per FR-020, FR-021 and CR-003 (partial)

## Phase 11: Final Convergence

- [X] T106 Enforce non-null audit reasons at the schema boundary, backfill historical events, supply safe reasons for every audit writer and add migration/live regression coverage per FR-021 (partial)

**Convergence Checkpoint**: Module 1 is complete only when T106 is checked and the next
`speckit-converge` pass finds no remaining implementation work.
