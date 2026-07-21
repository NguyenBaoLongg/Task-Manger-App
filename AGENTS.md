# Repository guidance for Codex

Respond in Vietnamese unless the user requests another language.

## Project architecture

- Read `docs/PRODUCT_REQUIREMENTS_MVP.md` before specifying, planning, or implementing product behavior. Treat its confirmed rules as the product source of truth and surface items in its unresolved-decisions section instead of guessing.
- Treat this repository as a multi-tenant SaaS composed of a TypeScript Node.js/Express/PostgreSQL backend and a native mobile client.
- For a new implementation, prefer Prisma for PostgreSQL and React Native with TypeScript/Expo unless the user or an existing codebase selects another supported option.
- Keep authoritative business data on the backend. Do not make Telegram, Google Sheets, or browser Local Storage system dependencies.
- Enforce tenant isolation, RBAC, JWT authentication, validation, auditability, idempotency, and tests across every module.

## Skill sequence

Use `create-project-flexibly` to select and coordinate the workflow. Build modules in this dependency order:

1. `design-multitenant-architecture`
2. `build-okr-kpi-engine`
3. `build-timekeeping-workflows`
4. `build-booking-export`
5. `build-mobile-frontend`

Use `ui-ux-pro-max`, `design-system`, and `ui-styling` for the mobile stage. Use `build-from-scratch-reference` only for first-principles research.

## Spec Kit workflow

- Keep one active feature/module at a time.
- Run `speckit-specify -> speckit-clarify -> speckit-plan -> speckit-checklist -> speckit-tasks -> speckit-analyze -> speckit-implement -> speckit-converge`.
- Do not run dependent stages in parallel.
- Do not start a downstream module until shared schemas, API contracts, migrations, and required tests for its dependencies are stable.
- Report contradictory requirements instead of silently choosing one.

## Local tools

- Run project-local Spec Kit with `& .\.tools\specify.ps1 <arguments>`.
- Run UI/UX Pro Max search with `& .\.tools\uiux.ps1 <arguments>`.
- Use PowerShell scripts under `.specify/scripts/powershell/` on Windows.

## Verification

- Validate custom skills after editing.
- Run relevant migrations, typecheck, lint, unit tests, integration tests, build, and mobile accessibility checks before marking a module complete.
- Do not require live AWS, FCM, or APNs credentials for local tests; use adapters and test doubles while preserving production-ready interfaces.
- Preserve and audit historical schedule, KPI, policy, penalty, booking-status, and membership changes.
