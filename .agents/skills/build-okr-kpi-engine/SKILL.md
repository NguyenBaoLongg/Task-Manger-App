---
name: build-okr-kpi-engine
description: "Specify, implement, and test a tenant-scoped OKR and KPI engine with company-to-department-to-individual alignment, measurable key results, automatic progress from dynamic form submissions, weekly check-ins, evidence-photo rules, perceptual-hash duplicate detection, photo-debt states, reminders, and penalties. Use for OKR, KPI, progress calculation, evidence validation, or related APIs and jobs."
---

# Build OKR and KPI Engine

Read [the OKR and KPI requirements](references/Skill_02_OKR_and_KPI_Engine.md) before planning or implementation. Require the multi-tenant architecture and authentication foundation to exist first.

## Workflow

1. Inspect the current feature specification, architecture, tenant model, dynamic-form model, and media-storage adapter.
2. Model objectives, key results, alignment edges, progress events, check-ins, comments, KPI definitions, KPI reports, evidence requirements, image fingerprints, photo debt, reminders, and penalty outcomes.
3. Scope every query and event by tenant. Authorize company, department, manager, and individual actions through RBAC.
4. Represent the objective alignment graph explicitly and prevent invalid cycles or cross-tenant edges.
5. Calculate KR progress deterministically from validated form submissions. Record source submission IDs and calculation history for auditability.
6. Implement weekly check-ins and manager comments with pagination, authorization, and audit fields.
7. Calculate required evidence count as actual KPI targets plus one when a revenue field is present in the applicable dynamic form.
8. Compute perceptual hashes asynchronously, reject or flag duplicates according to policy, and keep exact hash/version metadata.
9. Implement `WAITING_PHOTOS` as an explicit state transition. Make five-minute reminders and penalty finalization idempotent, retry-safe, and observable.
10. Add unit, integration, tenant-isolation, duplicate-image, timer, and state-transition tests.

## Boundaries

- Never accept manually entered KR progress when the KR is configured for automatic measurement.
- Do not perform expensive media hashing in the request thread.
- Do not let retries create duplicate reminders, penalties, or progress events.
- Treat the unlinked `[1]`, `[4]`, `[5]`, and `[6]` markers as unverified until source URLs are provided.
- Do not reintroduce Telegram reporting.

## Completion

Report APIs, background jobs, state machines, migrations, calculation rules, tests, and remaining product decisions. Run Spec Kit analysis before implementation when artifacts disagree.
