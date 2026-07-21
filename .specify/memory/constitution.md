<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles: all template placeholders replaced by Adsup governance principles
- Added sections: Technology and Data Constraints; Delivery Workflow and Quality Gates
- Removed sections: none; placeholder-only content was resolved
- Templates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ AGENTS.md (already aligned; no change required)
- Follow-up TODOs: none
-->

# Adsup Constitution

## Core Principles

### I. Tenant Isolation Is Structural and Testable

Every tenant-owned record MUST carry `tenant_id`. Repository and service boundaries MUST
derive tenant scope from the authenticated membership, never trust a tenant identifier from
an unverified client payload, and include tenant scope in relevant foreign keys, unique
constraints, indexes, cache keys, object-storage keys, jobs, realtime rooms, and audit data.
Every module that reads or mutates tenant data MUST include automated positive and negative
cross-tenant tests. PostgreSQL row-level security MAY be added as defense in depth, but it
MUST NOT replace application-level authorization and tenant-aware constraints.

### II. Identity, Authorization, and Business Authority Stay on the Backend

Google authentication establishes account identity; authorization MUST be resolved from an
active tenant membership, role bindings, permissions, branch scope, and effective assignment.
JWT access and refresh sessions MUST be revocable and validated by the backend. Hard-coded
administrator identifiers such as `ADMIN_IDS` are prohibited. The backend is authoritative
for timestamps, state transitions, business calculations, and permission decisions. Mobile
caches, Google profile fields, Telegram, Google Sheets, and browser Local Storage MUST NOT be
treated as authoritative business data.

### III. Historical Truth Is Versioned, Auditable, and Idempotent

Policies, dynamic forms, memberships, roles, schedules, KPI definitions, penalties, booking
states, and other historically significant rules MUST be versioned or represented by
append-only transitions with effective dates. Mutations MUST preserve actor, server time,
reason where required, before/after values, and the policy or schema version used. Closed
historical results MUST NOT be silently rewritten. Retried commands, jobs, webhooks, imports,
and state transitions MUST use explicit idempotency controls so the same intent cannot create
duplicate effects.

### IV. Contracts and Infrastructure Boundaries Come Before Consumers

Stable shared schemas and API contracts MUST be recorded before a downstream module consumes
them. Dynamic form templates MUST use versioned JSON Schema, submissions MUST retain the
template version and validated JSONB payload, and breaking contract changes MUST include a
migration or compatibility plan. Object storage, Redis/queues, Socket.io, FCM, and APNs MUST
sit behind interfaces with local test doubles. Secrets MUST stay outside source control.
External providers MAY transport or store derived data, but none may become the system of
record.

### V. Tests and Automated Quality Gates Are Part of the Definition of Done

Every implemented requirement MUST be traceable to automated tests at the appropriate level.
Tenant isolation, authorization failures, validation, idempotency, transactions, migrations,
and API contracts require integration or contract coverage; pure calculations require unit
coverage. A change is not complete until relevant tests, typecheck, lint, migration checks,
and builds pass. Required tests MUST be created or updated before the corresponding task is
marked complete, and defect fixes MUST include a regression test.

### VI. Operations, Privacy, and Scale Are Designed In

APIs MUST remain stateless and horizontally scalable; heavy media, notification, export, and
scheduled work MUST run through retry-safe workers. Structured logs, request correlation,
health/readiness signals, metrics, and actionable error reporting MUST be available without
exposing secrets or sensitive personal data. Media access MUST use authorized signed flows.
Retention, tombstones, legal holds, consent evidence, backup/restore, and production capacity
tests MUST follow the product requirements. Local and automated tests MUST use adapters or
test doubles and MUST NOT require live AWS, FCM, or APNs credentials.

## Technology and Data Constraints

- The repository MUST be a TypeScript monorepo. The backend baseline is Node.js, Express,
  PostgreSQL, and Prisma; the native client baseline is React Native with Expo.
- PostgreSQL is the authoritative transactional datastore. Dynamic submissions use validated
  JSONB while identity, authorization, policy versions, and audit relationships remain
  relational and tenant-scoped.
- Redis supports ephemeral cache, rate limits, queues, distributed coordination, and the
  Socket.io adapter. S3-compatible object storage holds binary media through signed access.
- Public and internal inputs MUST be schema-validated. Errors MUST use a stable machine code,
  safe user-facing message, correlation identifier, and appropriate HTTP status.
- Database migrations MUST be deterministic, reviewable, and safe to run repeatedly in test
  environments. Seed data MUST be deterministic and idempotent.
- Capacity and retention targets in `docs/PRODUCT_REQUIREMENTS_MVP.md` are mandatory planning
  and verification inputs, not hard-coded business limits.

## Delivery Workflow and Quality Gates

Work MUST keep one active Spec Kit feature and one active product module at a time. Modules
MUST be delivered in this dependency order: multi-tenant architecture, OKR/KPI engine,
timekeeping/workflows, booking/export, then mobile frontend. Each module MUST execute
`specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> converge`.

Before implementation, the specification MUST have no unresolved blocking clarification,
the plan MUST pass every Constitution Check, requirement checklists MUST be complete, tasks
MUST cover every buildable requirement, and analysis MUST report no unresolved CRITICAL
issue. During implementation, tasks MUST be completed in dependency order and marked only
after their verification passes. A module gate opens only when migrations, shared schemas,
contracts, documentation, tests, typecheck, lint, and build are stable and convergence finds
no remaining work.

## Governance

This constitution governs all Adsup specifications, plans, tasks, code, reviews, and module
gates. `docs/PRODUCT_REQUIREMENTS_MVP.md` remains the product source of truth; if it conflicts
with a technical artifact, the artifact MUST be corrected or the conflict MUST be raised
explicitly before implementation.

Amendments require a documented rationale, an updated Sync Impact Report, propagation to
dependent templates and guidance, and semantic versioning. MAJOR changes remove or redefine
a governing principle incompatibly, MINOR changes add or materially expand a principle, and
PATCH changes clarify wording without changing obligations. Every plan and implementation
review MUST explicitly verify constitutional compliance; deviations require written
justification in the plan and MUST NOT weaken a MUST-level tenant, security, history, privacy,
or test obligation.

**Version**: 1.0.0 | **Ratified**: 2026-07-19 | **Last Amended**: 2026-07-19
