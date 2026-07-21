---
name: create-project-flexibly
description: "Orchestrate project creation from multiple Markdown requirements using GitHub Spec Kit, the five SaaS module skills, UI/UX Pro Max, design-system guidance, and optional Build Your Own X research. Use when starting this project, deciding the next module, running an end-to-end delivery sequence, converting project documents into specs and code, or coordinating several installed skills without violating dependencies."
---

# Create Project Flexibly

Choose the smallest safe workflow, keep one active Spec Kit feature at a time, and complete modules from foundations to clients.

## Source Documents and Modules

Use these skills in order unless the user explicitly changes scope:

1. `$design-multitenant-architecture`
2. `$build-okr-kpi-engine`
3. `$build-timekeeping-workflows`
4. `$build-booking-export`
5. `$build-mobile-frontend`

Use `$ui-ux-pro-max` and `$design-system` inside the mobile stage. Use `$build-from-scratch-reference` only for first-principles architecture research.

## Delivery Workflow

1. Read `.specify/memory/constitution.md`, applicable module requirements, and existing code.
2. Run `$speckit-constitution` if project principles are missing or inconsistent.
3. For the current module, run `$speckit-specify`, then `$speckit-clarify` when material ambiguity remains.
4. Run `$speckit-plan`, `$speckit-checklist`, `$speckit-tasks`, and `$speckit-analyze`.
5. Implement with the current module skill plus `$speckit-implement`.
6. Run tests and `$speckit-converge`. Do not start the next module while required work remains.
7. Record stable API contracts before a downstream module consumes them.

## Cross-cutting Rules

- Keep all tenant-owned data isolated with `tenant_id` and tenant-aware authorization.
- Use RBAC and JWT; never use `ADMIN_IDS`.
- Use PostgreSQL and versioned JSONB dynamic forms as the shared data foundation.
- Use object storage for evidence media, Socket.io for realtime chat, and FCM/APNs for push notifications behind adapters.
- Do not depend on Telegram, Google Sheets, or browser Local Storage as authoritative system infrastructure.
- Treat the bracketed citation markers in the supplied documents as unresolved until actual source URLs are provided.
- Report contradictions before implementation and update the owning source of truth.

## Parallel Work

Parallelize only independent review or research after the active spec or plan is stable and only when the user explicitly requests delegation. Never parallelize dependent Spec Kit stages or multiple modules that share unsettled schemas.

## Completion

Report the active module, Spec Kit artifacts, skills used, code and migrations changed, tests run, unresolved decisions, and whether the dependency gate for the next module is satisfied.
