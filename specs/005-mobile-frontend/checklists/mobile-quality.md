# Mobile Frontend Requirements Quality Checklist

**Purpose**: Validate that the Module 5 requirements are complete, clear, consistent and
measurable before task generation and implementation.
**Created**: 2026-07-26
**Feature**: [spec.md](../spec.md)

**Focus**: Auth/tenant/RBAC, API compatibility, media privacy, dynamic forms, booking and
quick actions, chat/notifications, accessibility and mobile resilience.
**Depth**: Standard pre-implementation review.
**Audience**: Author and design/review team.

## Requirement Completeness

- [ ] CHK001 Are authentication, profile confirmation, session refresh, logout and re-authentication requirements defined for every protected mobile journey? [Completeness, Spec §FR-001, §FR-018]
- [ ] CHK002 Are tenant selection, membership display, branch selection and active-scope changes defined for both single-tenant and multi-tenant accounts? [Completeness, Spec §FR-002, §FR-003]
- [ ] CHK003 Are requirements for all three primary navigation areas and guarded routes defined, including their relationship to deep links? [Completeness, Spec §FR-004, §FR-020]
- [ ] CHK004 Are dashboard, KPI, action-center, approval, photo-debt and booking source types all named as action-center content? [Completeness, Spec §FR-005, §FR-006]
- [ ] CHK005 Are full-day leave, morning half-day leave, date-range leave, late notice, sudden leave and shift-change request requirements distinguished? [Completeness, Spec §FR-007, §FR-013]
- [ ] CHK006 Are scheduled booking, walk-in, dynamic form, ARRIVED, customer consent, proof photo, photo debt, outcome and reschedule requirements all covered? [Completeness, Spec §FR-010, §FR-011]
- [ ] CHK007 Are chat history, message sending, pagination, unread state, reconnect and optimistic reconciliation requirements all present? [Completeness, Spec §FR-015]

## Requirement Clarity

- [ ] CHK008 Is the authority boundary between backend decisions and mobile presentation explicit for tenant scope, RBAC, KPI values, penalties, approvals and booking state? [Clarity, Spec §FR-003, §FR-014, §CR-002]
- [ ] CHK009 Are the permitted branch scopes and the conditions under which a branch selector is shown unambiguous for employees and managers? [Clarity, Spec §FR-002, §FR-006, §CR-001]
- [ ] CHK010 Are the supported JSON Schema features, unsupported-schema behavior and server-validation precedence specified clearly enough to avoid silently losing fields? [Clarity, Spec §FR-010, §FR-024]
- [ ] CHK011 Is the video check-in sequence explicit about policy acknowledgement, camera permission, full-body/work-area capture, preview, upload progress, retry, cancellation and cleanup? [Clarity, Spec §FR-008, §FR-009]
- [ ] CHK012 Is the “Đã đến” requirement explicit that proof media and the required customer-consent flow precede the ARRIVED command? [Clarity, Spec §FR-017, Clarifications §Session 2026-07-26]
- [ ] CHK013 Is “Hủy/Rời lịch” unambiguously separated into cancellation and reschedule paths with current reason-version selection and state refresh? [Clarity, Spec §FR-017, contracts/notification-quick-actions.md]
- [ ] CHK014 Are “critical path”, “near realtime”, “safe error”, “appropriate filter” and “supported capability” defined with observable boundaries? [Clarity, Spec §FR-006, §FR-018, §FR-025]

## Requirement Consistency

- [ ] CHK015 Do the authentication and tenant-context requirements consistently prohibit local tenant IDs, Google profile fields and cached permissions from becoming authority? [Consistency, Spec §FR-001..FR-003, §CR-001, §CR-002]
- [ ] CHK016 Are local drafts/cache requirements consistent with the prohibition on authoritative mobile business data, including logout, tenant switch and session-expiry eviction? [Consistency, Spec §FR-019, §CR-004]
- [ ] CHK017 Do media requirements consistently require consent, signed authorization, retention handling and redacted logs for video, customer photos and evidence? [Consistency, Spec §FR-008, §FR-023, §CR-004]
- [ ] CHK018 Are idempotency and optimistic-concurrency requirements consistent across attendance, approvals, booking, media upload, chat and notification actions? [Consistency, Spec §FR-012, §FR-017, §CR-003]
- [ ] CHK019 Are the bottom-navigation requirements consistent with the scope exclusions for advanced OKR hierarchy, weekly check-in, PDF and customer self-booking? [Consistency, Spec §FR-004, §FR-026]
- [ ] CHK020 Do the quick-action requirements align with the Module 4 arrival/outcome contracts and avoid a direct lock-screen mutation that lacks consent, media or reason context? [Consistency, Spec §FR-017, contracts/mobile-api.md]

## Acceptance Criteria Quality

- [ ] CHK021 Can the 60-second login/workspace outcome be measured across the stated valid-session and multi-tenant scenarios? [Acceptance Criteria, Spec §SC-001]
- [ ] CHK022 Is the cross-tenant and out-of-branch isolation outcome measurable by a defined request/deep-link/notification scenario set? [Acceptance Criteria, Spec §SC-002, §CR-001]
- [ ] CHK023 Are the 3-second Dashboard/action-center target and its data-ready boundary defined for cold start, warm cache and degraded network conditions? [Acceptance Criteria, Spec §SC-003]
- [ ] CHK024 Can “100% correct FormVersion rendering” be assessed against a defined schema fixture set and server-validation behavior? [Measurability, Spec §SC-004]
- [ ] CHK025 Are video, booking, notification, accessibility and recovery success criteria tied to named sample states, retry limits or observable server outcomes? [Measurability, Spec §SC-005..SC-009]
- [ ] CHK026 Does the mobile-build/E2E criterion define what “real API of Module 1-4” means while explicitly allowing credential-free provider doubles? [Measurability, Spec §SC-010, Assumptions]

## Scenario and Edge-Case Coverage

- [ ] CHK027 Are primary, alternate, exception and recovery requirements present for auth refresh, tenant switching, media upload, dynamic forms, booking conflicts, chat reconnect and quick actions? [Coverage, Spec §Edge Cases, §FR-018]
- [ ] CHK028 Are camera denial, missing storage, interrupted upload, app termination, expired signed URL and background-resume outcomes defined? [Edge Case, Spec §FR-008, §FR-009, §CR-004]
- [ ] CHK029 Are stale policy, FormVersion, cancellation reason, booking state, permission and deep-link expiry cases distinguished from ordinary validation failures? [Coverage, Spec §Edge Cases, §FR-012, §FR-020]
- [ ] CHK030 Are duplicate push delivery, duplicate Socket.io events, duplicate chat send and repeated idempotent mutation scenarios described without conflicting badge/message expectations? [Coverage, Spec §FR-015..FR-017]
- [ ] CHK031 Are empty, loading, offline, unauthorized, forbidden, conflict, provider-unavailable and server-error states defined for every critical feature group? [Completeness, Spec §FR-018]
- [ ] CHK032 Are platform differences between iOS and Android quick actions, notification permissions, camera behavior and fallback routes explicitly covered? [Coverage, Spec §FR-022, Assumptions]
- [ ] CHK033 Are accessibility scenarios defined for small phones, large text, screen readers, focus order, semantic state, touch targets, reduced motion and tablet layouts? [Coverage, Spec §FR-021, §FR-022, §SC-008]

## Non-Functional Requirements

- [ ] CHK034 Are tenant isolation, RBAC denial, idempotency, audit preservation and API compatibility requirements assigned to every mutation category rather than only to the shared client? [Security, Spec §CR-001..CR-003, §CR-006]
- [ ] CHK035 Are token, PII, customer-photo, video, consent-evidence, signed-URL, object-key and diagnostic-log handling requirements specific enough to review for leakage? [Privacy, Spec §FR-023, §CR-004, §CR-005]
- [ ] CHK036 Are cache bounds, eviction triggers, media deletion timing and local draft sensitivity requirements documented for logout, tenant switch, account suspension and refresh failure? [Privacy, Spec §FR-019, §CR-004]
- [ ] CHK037 Are UI responsiveness, media-processing non-blocking behavior, pagination and network-retry expectations quantified or linked to a measurable acceptance criterion? [Performance, Spec §SC-003, §SC-009]
- [ ] CHK038 Are telemetry requirements limited to safe correlation IDs, problem codes and lifecycle metrics without collecting secrets or raw sensitive payloads? [Observability, Spec §CR-005]

## Dependencies and Assumptions

- [ ] CHK039 Are the exact Module 1-4 OpenAPI/domain-event sources and the consumed operations named so that a contract change can be detected before mobile implementation? [Dependency, contracts/mobile-api.md, §FR-024]
- [ ] CHK040 Are Google auth, FCM/APNs, Socket.io, camera and object-storage adapter responsibilities separated from local test doubles and production credentials? [Dependency, research.md, Spec §Assumptions]
- [ ] CHK041 Is the Expo development-build requirement stated for capabilities that cannot be validated in Expo Go? [Dependency, plan.md §Technical Context, quickstart.md]
- [ ] CHK042 Are design-token, navigation, component and accessibility deliverables required before broad UI implementation and linked to the stated user stories? [Dependency, plan.md §Phase 0, §Phase 2]
- [ ] CHK043 Are remaining backend dependencies and the rule for stopping on a contract gap explicitly documented instead of allowing mobile-only fields or mock-only critical paths? [Dependency, Spec §FR-024, §FR-026, contracts/mobile-api.md]

## Ambiguities and Conflicts

- [ ] CHK044 Are the notification payload fields, safe display text, event/effect dedupe key and deep-link route schema defined consistently across Module 1 realtime, Module 2-4 events and the mobile quick-action contract? [Ambiguity, contracts/notification-quick-actions.md]
- [ ] CHK045 Is the phrase “ảnh chứng minh khách đã đến” defined as the permitted customer-photo media purpose and connected to consent, upload authorization and retention policy? [Ambiguity, Spec §FR-017, contracts/mobile-api.md]
- [ ] CHK046 Are “outcome”, “cancellation” and “reschedule” mapped consistently to the Module 4 reason-version and optimistic-concurrency contract? [Ambiguity, Spec §FR-011, §FR-017, contracts/mobile-api.md]
- [ ] CHK047 Are notification badge ownership and read/clear semantics specified for action items, approvals, photo debt, KPI and booking events without inventing a mobile-only source of truth? [Gap, Spec §FR-006, §FR-016]
- [ ] CHK048 Does the specification explicitly identify any unresolved native capability or backend contract issue that must block implementation rather than be guessed in the mobile client? [Gap, Spec §FR-024, §CR-006]

## Notes

- This checklist evaluates the quality of requirements, not implementation behavior.
- Items remain unchecked until the author/reviewer determines that the corresponding
  requirement is complete, clear, consistent and measurable.
