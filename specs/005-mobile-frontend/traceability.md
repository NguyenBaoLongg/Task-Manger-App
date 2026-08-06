# Mobile Traceability

Satisfies CR-006: every FR, CR and SC is mapped to the artifact that verifies it before the
requirement may be marked complete.

Paths are relative to `apps/mobile/`. Status values:

- **PASS** — verified by an automated suite that currently passes locally.
- **REVIEW** — verified by inspection or a non-executable artifact; no automated assertion.
- **BLOCKED** — the owning artifact exists but its result cannot be recorded without a native
  device; see the open task in the last column.

## Functional Requirements

| Req | Subject | Verifying artifact | Status | Open task |
|---|---|---|---|---|
| FR-001 | Auth, access/refresh session, no committed secret | `tests/unit/session-coordinator.test.ts`, `tests/unit/auth-response.test.ts`, `tests/unit/api-client.test.ts`, `tests/contract/auth-workspace.contract.test.ts` | PASS | — |
| FR-002 | Tenant/workspace selection, conditional branch selector | `tests/unit/tenant-context.test.ts`, `tests/integration/auth-workspace.integration.test.ts` | PASS | — |
| FR-003 | Backend-issued tenant/branch scope on every request | `tests/unit/tenant-context.test.ts`, `tests/integration/auth-workspace.integration.test.ts`, `tests/integration/dashboard-navigation.integration.test.ts` | PASS | — |
| FR-004 | Bottom navigation, accessible labels, deep-linkable routes | `tests/integration/dashboard-navigation.integration.test.ts`, `tests/accessibility/screen-primitives.a11y.test.tsx`, `tests/unit/auth-deep-links.test.ts` | PASS | — |
| FR-005 | Dashboard KPI, missing data, deadline, badges | `tests/unit/kpi-summary.test.tsx`, `tests/contract/dashboard-action-items.contract.test.ts`, `tests/accessibility/dashboard.a11y.test.tsx` | PASS | — |
| FR-006 | Action-center employee/manager filters, pagination, deep link | `src/features/action-items/action-item-feed.ts`, `tests/integration/dashboard-action-items.integration.test.ts`, `tests/unit/action-item-reconciliation.test.ts` | PASS | — |
| FR-007 | Shift calendar, check-in state, leave/approval, penalty ledger | `tests/contract/attendance-workflows.contract.test.ts`, `tests/integration/attendance-checkin.integration.test.ts`, `tests/integration/leave-approval.integration.test.ts` | PASS | — |
| FR-008 | Native camera video check-in, permission, preview, consent | `tests/integration/attendance-video-checkin-flow.integration.test.ts`, `tests/unit/attendance-media-upload.test.ts`, `tests/accessibility/attendance.a11y.test.tsx` | PASS | — |
| FR-009 | Interrupted upload, lifecycle, no duplicate effect | `tests/unit/attendance-media-upload.test.ts`, `tests/unit/mutation-boundary.test.ts`, `tests/integration/attendance-checkin.integration.test.ts` | PASS | — |
| FR-010 | Dynamic form renderer, JSON Schema subset, compatibility error | `tests/unit/dynamic-form-renderer.test.ts`, `tests/contract/booking-forms.contract.test.ts` | PASS | — |
| FR-011 | Booking create/view/edit, calendar, walk-in, ARRIVED, outcome, reschedule | `tests/integration/booking-calendar.integration.test.ts`, `tests/integration/booking-outcome.integration.test.ts`, `tests/integration/booking-arrived-proof-flow.integration.test.ts`, `tests/unit/booking-ui-models.test.ts` | PASS | — |
| FR-012 | Conflict, optimistic concurrency, stale version, permission denial | `tests/integration/booking-calendar.integration.test.ts`, `tests/unit/booking-ui-models.test.ts`, `tests/contract/booking-forms.contract.test.ts` | PASS | — |
| FR-013 | Approval create/view/decide with actor, reason, idempotency | `tests/integration/leave-approval.integration.test.ts`, `tests/integration/approval-detail-flow.integration.test.ts`, `tests/contract/attendance-workflows.contract.test.ts` | PASS | — |
| FR-014 | Penalty ledger read-only; no client-side calculate/waive/refund | `tests/unit/payment-proof-actions.test.ts`, `tests/integration/attendance-privacy.integration.test.ts` | PASS | — |
| FR-015 | Tenant-scoped chat, pagination, reconnect, unread, redaction | `tests/unit/chat-realtime.test.ts`, `tests/contract/chat-notifications.contract.test.ts`, `tests/accessibility/chat-notifications.a11y.test.tsx` | PASS | — |
| FR-016 | Notification badges without duplicate on refresh/retry | `tests/unit/badge-store-ui.test.ts`, `tests/unit/notification-reconciliation.test.ts`, `tests/contract/chat-notifications.contract.test.ts` | PASS | — |
| FR-017 | Quick actions `Đã đến` (proof media) and `Hủy/Rời lịch` (reason) | `tests/integration/quick-actions.integration.test.ts`, `tests/integration/native-quick-actions.integration.test.ts`, `tests/unit/customer-photo-upload.test.ts`, `tests/integration/booking-arrival-proof.integration.test.ts` | PASS | — |
| FR-018 | Loading, empty, error, unauthorized, forbidden, conflict, offline, session-expired | `tests/integration/mobile-resilience.integration.test.ts`, `tests/unit/api-client.test.ts` | PASS | — |
| FR-019 | Draft preserved; local cache never authoritative | `tests/unit/privacy-policy.test.ts`, `tests/unit/tenant-context.test.ts`, `tests/integration/mobile-resilience.integration.test.ts` | PASS | — |
| FR-020 | Deep link / notification / quick action re-check auth, scope, state, expiry | `tests/unit/auth-deep-links.test.ts`, `tests/integration/quick-actions.integration.test.ts`, `tests/integration/native-quick-actions.integration.test.ts` | PASS | — |
| FR-021 | Back behavior, safe areas, focus order, semantic label, touch target | `tests/accessibility/screen-primitives.a11y.test.tsx`, `tests/accessibility/critical-path-matrix.a11y.test.tsx` | PASS | — |
| FR-022 | Light/dark, dynamic text, reduced motion, orientation, tablet | `tests/unit/theme.test.ts`, `tests/unit/theme-runtime.test.ts`, `tests/accessibility/theme-layout.a11y.test.tsx` | PASS | — |
| FR-023 | No PII/token/signed URL/object key in logs; media privacy lifecycle | `src/observability/safe-logger.ts`, `tests/unit/privacy-policy.test.ts`, `tests/integration/notification-privacy.integration.test.ts`, `tests/integration/attendance-privacy.integration.test.ts` | PASS | — |
| FR-024 | Published Module 1-4 contracts only; stop on contract gap | `tests/contract/module-compatibility.contract.test.ts`, `tests/contract/module-contract-fixtures.test.ts` | PASS | — |
| FR-025 | Critical paths covered by the full test matrix | All suites in this table; the native E2E leg is not yet executed | BLOCKED | T111 |
| FR-026 | MVP exclusions (no advanced OKR, PDF, self-booking, payroll, landing page) | Negative scope. No automated assertion exists; verified by scope review recorded in `checklists/requirements.md` Notes | REVIEW | — |

## Constitutional & Cross-Cutting Requirements

| Req | Subject | Verifying artifact | Status | Open task |
|---|---|---|---|---|
| CR-001 | Tenant context on every screen/cache/request/deep link, with negative tests | `tests/integration/auth-workspace.integration.test.ts`, `tests/integration/dashboard-navigation.integration.test.ts`, `tests/integration/attendance-privacy.integration.test.ts` | PASS | — |
| CR-002 | RBAC/membership/branch scope from backend; nothing hard-coded | `tests/unit/tenant-context.test.ts`, `tests/integration/leave-approval.integration.test.ts`, `tests/unit/payment-proof-actions.test.ts` | PASS | — |
| CR-003 | Idempotency boundary on every retryable mutation and quick action | `tests/unit/mutation-boundary.test.ts`, `tests/integration/quick-actions.integration.test.ts`, `tests/unit/attendance-media-upload.test.ts` | PASS | — |
| CR-004 | Least-privilege, signed flow, redacted logs, retention, no authoritative local media | `tests/unit/privacy-policy.test.ts`, `tests/unit/customer-photo-upload.test.ts`, `tests/integration/attendance-privacy.integration.test.ts` | PASS | — |
| CR-005 | Safe telemetry for request failure, auth refresh, upload, reconnect, notification action, latency | `src/observability/safe-telemetry.ts`, `tests/unit/privacy-policy.test.ts`, `tests/integration/attendance-privacy.integration.test.ts`. Redaction is asserted; the **latency** metric has no dedicated assertion and is only exercised indirectly by `tests/integration/mobile-performance.integration.test.ts` | REVIEW | — |
| CR-006 | Every FR/CR traced before completion | This document | PASS | — |

## Success Criteria

| SC | Threshold | Verifying artifact | Denominator | Status | Open task |
|---|---|---|---|---|---|
| SC-001 | ≥19/20 login+workspace under 60s per device profile | `tests/e2e/auth-workspace-performance.e2e.ts` | 20 per device profile | BLOCKED — harness real, numerator not recorded | T118, T132 |
| SC-002 | 100% cross-tenant / out-of-branch requests denied | `tests/integration/auth-workspace.integration.test.ts`, `tests/integration/dashboard-navigation.integration.test.ts`, `tests/integration/attendance-privacy.integration.test.ts`, `tests/integration/notification-privacy.integration.test.ts` | All negative-scope cases in those suites | PASS | — |
| SC-003 | ≥19/20 Dashboard/action center under 3s per device and data profile | `tests/e2e/dashboard-performance.e2e.ts` | 20 per device profile × `COLD_START`, `WARM_CACHE`, `DEGRADED_NETWORK` | BLOCKED — harness real, numerator not recorded | T119, T133 |
| SC-004 | 100% forms render per FormVersion; server errors surfaced | `tests/unit/dynamic-form-renderer.test.ts`, `tests/contract/booking-forms.contract.test.ts` | Schema fixture set in those suites | PASS | — |
| SC-005 | 100% video check-in samples with permission, preview, progress, retry | `tests/integration/attendance-video-checkin-flow.integration.test.ts`, `tests/unit/attendance-media-upload.test.ts` | Sample set in those suites | PASS under Jest; native capture not yet exercised | T111 |
| SC-006 | 100% booking/ARRIVED/consent/outcome/reschedule/quick action keep scope, state, idempotency | `tests/integration/booking-calendar.integration.test.ts`, `tests/integration/booking-outcome.integration.test.ts`, `tests/integration/booking-arrived-proof-flow.integration.test.ts`, `tests/integration/quick-actions.integration.test.ts`, `tests/unit/mutation-boundary.test.ts` | Boundary case set in those suites | PASS | — |
| SC-007 | 100% notification deep links correct; duplicates do not inflate badges | `tests/unit/notification-reconciliation.test.ts`, `tests/unit/badge-store-ui.test.ts`, `tests/integration/notification-privacy.integration.test.ts` | Sample set in those suites | PASS | — |
| SC-008 | 100% critical screens meet touch target, label/role/focus, safe area | `tests/accessibility/critical-path-matrix.a11y.test.tsx`, `tests/accessibility/theme-layout.a11y.test.tsx`, `tests/accessibility/screen-primitives.a11y.test.tsx` | Critical screen matrix in those suites | PASS under Jest; real phone/tablet not yet exercised | T111 |
| SC-009 | ≥95% recovery in recoverable critical paths | `tests/integration/recovery-rate.integration.test.ts` | 20 injected failure scenarios minimum | PASS — 20/20 | — |
| SC-010 | Mobile build + E2E smoke against the real Module 1-4 API, no mock-only critical path | `tests/contract/module-compatibility.contract.test.ts`, `tests/e2e/mvp-critical-path.e2e.ts` | Full critical-path journey | BLOCKED — contract leg passes, native E2E leg not executed | T107, T135 |

## Notes

- The shared resolver is the only owner of tenant, branch, permission, freshness and mutation
  validation for action-item, push and native-action intents. Native adapters only normalize
  platform identifiers and call that resolver (`src/notifications/native-action-handler.ts`,
  resolver from T046; normalization covered by `tests/integration/native-quick-actions.integration.test.ts`).
- Detox matrix configuration is asserted statically by `tests/unit/detox-config.test.ts`; that is a
  configuration check, not a device result.
- No test file currently annotates its FR/CR/SC identifier in source. Only SC-001, SC-003 and
  SC-009 appear as literals in `tests/e2e/auth-workspace-performance.e2e.ts`,
  `tests/e2e/dashboard-performance.e2e.ts` and `tests/integration/recovery-rate.integration.test.ts`.
  Every other mapping in this document is by inspection and will drift if suites are renamed.
- Two rows are **REVIEW**, not PASS: FR-026 (negative scope, nothing to assert) and CR-005 (latency
  telemetry has no dedicated assertion). Neither is blocked on hardware.
