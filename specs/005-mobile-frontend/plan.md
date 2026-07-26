# Implementation Plan: Mobile Frontend MVP

**Branch**: `005-mobile-frontend` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-mobile-frontend/spec.md`

## Summary

Build a native React Native TypeScript application with Expo that consumes the stable Module 1-4
HTTP, media, notification and realtime contracts. The app will provide authenticated tenant and
branch-scoped navigation for Dashboard/OKR-KPI, Workspace and Chat, while keeping business state,
RBAC, versioned forms, media authorization, audit and idempotency on the backend.

The implementation will begin with the API/session/tenant foundation, then add the tab shell and
dashboard, attendance/media and approvals, booking/forms/arrival proof, chat/notifications/quick
actions, and finally accessibility, offline recovery, native capability and E2E hardening. No
backend migration is expected; any contract mismatch is a blocking compatibility issue to fix in
the owning Module 1-4 contract before the mobile client consumes it.

## Technical Context

**Language/Version**: TypeScript; React Native with the exact Expo SDK version selected and locked
by T001 in `apps/mobile/package.json` and `pnpm-lock.yaml`; Node.js `>=24` for the monorepo

**Primary Dependencies**: Expo Router, React Native, TanStack Query, Zustand, SecureStore, Camera,
FileSystem, Notifications, Socket.io client, shared Zod contracts, Jest with `jest-expo`, React
Native Testing Library and Detox for device E2E

**Storage**: PostgreSQL remains backend authority. The mobile client uses SecureStore for session
secrets and bounded non-authoritative cache/draft storage for transient UX state; media binaries
are uploaded through signed object-storage intents and are not retained as business data locally.

**Testing**: Jest/`jest-expo` is the only mobile test runner, with React Native Testing Library,
contract tests against the Module 1-4 OpenAPI documents and shared schemas, integration tests
against the local API, Detox E2E smoke, accessibility assertions, TypeScript typecheck, ESLint and
Expo production/development build checks

**Target Platform**: iOS and Android phones, with tablet portrait/landscape support; Expo
development build required for native camera, notifications and quick-action verification

**Project Type**: Native mobile app in the existing TypeScript monorepo

**Performance Goals**: Critical screens render and show an explicit loading state without blocking
the UI thread; server page reads target the specification's p95 goals; media capture/upload,
reconnect and retry remain responsive and bounded; small-phone, large-phone and tablet layouts
remain usable at large text sizes

**Constraints**: Backend is authoritative; every request is tenant/branch/RBAC scoped; mutations
must preserve idempotency and optimistic-concurrency values; media uses consent/signed flows and
retention; no PDF, advanced OKR hierarchy, weekly OKR check-in, customer self-booking, payroll,
mock-only critical path or production provider credential is required for local verification

**Scale/Scope**: One mobile app with three primary navigation areas and guarded routes covering
the six user stories in `spec.md`: auth/workspace, dashboard/KPI/action center, attendance/leave/
approval/penalty, booking/forms/calendar/photo debt, chat/notifications/quick actions and
accessibility/reliability hardening

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- [x] Every tenant-owned data path is tenant-scoped in schema, authorization, constraints,
      indexes, cache/storage keys, workers, realtime rooms, and negative isolation tests.
      Mobile query keys, deep links and rooms carry the current tenant/branch context; the
      backend remains responsible for the actual isolation tests.
- [x] Identity and permissions come from authenticated membership/RBAC/branch scope; the
      backend remains authoritative and no hard-coded administrator IDs are introduced.
- [x] Historical business state is versioned or append-only, audited, transaction-safe, and
      idempotent under retries and concurrent requests. Mobile sends state/policy/form versions
      and never rewrites history.
- [x] Shared schemas and contracts are explicit; dynamic JSONB is schema-versioned; S3,
      Redis, Socket.io, FCM, and APNs are behind testable adapters. The mobile contract map
      references the stable Module 1-4 documents and local provider doubles.
- [x] Unit, contract, integration, tenant-isolation, migration, typecheck, lint, and build
      gates are planned with traceability to requirements.
- [x] Observability, privacy/consent, retention, backup/restore, capacity targets, and
      credential-free local testing are addressed where the feature touches them.

## Project Structure

### Documentation (this feature)

```text
specs/005-mobile-frontend/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mobile-api.md
│   └── notification-quick-actions.md
├── checklists/requirements.md
└── tasks.md                         # Phase 2 output, created by speckit-tasks
```

### Source Code

```text
apps/mobile/
├── app/                              # Expo Router guarded routes and tab layout
│   ├── (auth)/
│   ├── (tabs)/
│   ├── booking/
│   ├── attendance/
│   ├── approvals/
│   ├── chat/
│   └── _layout.tsx
├── src/
│   ├── api/                          # authenticated client and operation adapters
│   ├── auth/                         # provider, session refresh and secure storage
│   ├── tenant/                       # membership, branch scope and cache eviction
│   ├── features/                     # dashboard, KPI, attendance, booking, chat, approvals
│   ├── components/                   # accessible reusable native components
│   ├── forms/                        # versioned JSON Schema renderer and validation bridge
│   ├── media/                        # camera, checksum, upload intent and cleanup
│   ├── notifications/                # endpoint registration, badges, native actions and deep links
│   ├── navigation/                   # shared validated deep-link resolver
│   ├── realtime/                     # Socket.io lifecycle and scoped event reconciliation
│   ├── storage/                      # bounded drafts/cache adapters
│   ├── theme/                        # design tokens, typography and accessibility settings
│   └── types/
├── tests/
│   ├── unit/
│   ├── contract/
│   ├── integration/
│   ├── accessibility/
│   └── e2e/
├── app.config.ts
├── package.json
└── tsconfig.json
```

**Structure Decision**: Use a new `apps/mobile` workspace package. Feature modules own screen
composition and operation adapters, while auth, tenant scope, API errors, media, notifications,
realtime and design tokens are shared infrastructure. No business table or authoritative backend
projection is duplicated in the client.

## Implementation Phases

### Phase 0: Research and design baseline

Completed by this plan: research decisions, client data model, API/notification contract maps,
quickstart validation scenarios and constitution re-check. The `$ui-ux-pro-max`, `$design-system`
and `$ui-styling` guidance must be applied before broad UI implementation to produce native
accessible tokens and component specifications.

### Phase 1: App foundation and authentication

Create the Expo package, build configuration, environment adapter, API error model, secure session
storage, Google provider adapter/test double, refresh/logout single-flight handling, profile
confirmation, tenant/workspace selection and branch-scoped query invalidation. Add negative tests
for foreign tenant/branch, forbidden permissions, expired sessions and stale deep links.

### Phase 2: Accessible shell and dashboard

Implement guarded Expo Router layouts, bottom navigation, safe areas, theme tokens, loading/empty/
error states, Dashboard/OKR-KPI views, action-item feed, cursor pagination, badge counts and deep
links. Use action-item and KPI contracts as-is; no local KPI calculation or advanced OKR tree.

### Phase 3: Attendance, media and approval flows

Implement schedules/off-calendar/policy acknowledgement, native video capture, preview, checksum,
signed upload, progress, cancellation/retry/cleanup and check-in submission. Add leave/late/sudden
leave/shift request forms through `/workflows/requests`, approval decisions, penalty ledger and
payment-proof upload only for authorized users. Test consent, privacy, idempotency, state versions,
tenant/branch denial and interrupted uploads.

### Phase 4: Booking, dynamic forms and arrival proof

Implement published FormVersion renderer, customer/booking calendar, branch filters, scheduled and
walk-in creation, 60-minute conflict feedback, customer consent, proof-photo upload, ARRIVED,
photo debt, tour completion, outcome and reschedule. The “Đã đến” quick flow must collect proof
media and use the latest server state; “Hủy/Rời lịch” must use current reason versions in-app.

### Phase 5: Chat, notifications and quick actions

Implement tenant-scoped channel/message pagination, Socket.io reconnect and reconciliation, push
endpoint registration, event/effect deduplication, badges, safe notification previews and deep
links. Add iOS/Android capability adapters and native response handling for quick actions; every
action response and notification deep link delegates to the shared validated resolver, with a
validated in-app fallback.

### Phase 6: Quality, accessibility and release verification

Run small/large/tablet layout checks, light/dark mode, dynamic Vietnamese text, screen reader and
focus-order checks, reduced motion, offline/session-expiry/permission-denied recovery, API contract
compatibility, unit/contract/integration/E2E tests, the SC-001 and SC-003 20-run timing samples,
the SC-009 recovery matrix with its injected-failure denominator, typecheck, lint and mobile build.
Update README and operations documentation with real commands and provider requirements only after
verification.

## Requirement Traceability

| Spec requirements | Planned ownership |
|---|---|
| FR-001..FR-005, CR-001..CR-003 | Phase 1 auth, tenant context, API client and mutation boundary |
| FR-006..FR-009, FR-022, FR-024 | Phase 2 shell, dashboard, action items, design tokens and deep links |
| FR-010, FR-013, FR-014, FR-023 | Phases 3-4 versioned forms, approvals, penalty and media |
| FR-011..FR-012 | Phase 4 booking/calendar/arrival/reschedule adapters |
| FR-015..FR-017 | Phase 5 chat, notifications and proof/reason quick actions |
| FR-018..FR-021, FR-025..FR-026, CR-004..CR-006 | Phase 6 resilience, accessibility, privacy and scope gates |
| SC-001..SC-010 | Quickstart scenarios plus the corresponding phase test suites |

## Post-Design Constitution Check

- [x] No mobile path creates an unscoped tenant/branch request or authoritative local record.
- [x] Token, media, consent and PII handling has explicit secure-storage, signed-flow,
      redaction and eviction behavior.
- [x] Mutations use server contracts, idempotency and optimistic concurrency; retry/reconnect
      reconciliation is part of the design.
- [x] Dynamic forms, KPI/action items, attendance, booking, chat and notification inputs are
      versioned/validated by the existing Module 1-4 contracts.
- [x] Verification includes native permissions, accessibility, API compatibility, negative RBAC,
      integration, E2E, typecheck, lint and build gates.
- [x] No constitution violation or unresolved planning clarification remains.

## Complexity Tracking

No constitution violations require justification. The mobile app is one new workspace package;
shared backend modules remain the source of truth.
