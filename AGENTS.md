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
- Run project-local Graphify with `& .\.tools\graphify.ps1 <arguments>`.
- Use PowerShell scripts under `.specify/scripts/powershell/` on Windows.

## Verification

- Validate custom skills after editing.
- Run relevant migrations, typecheck, lint, unit tests, integration tests, build, and mobile accessibility checks before marking a module complete.
- Do not require live AWS, FCM, or APNs credentials for local tests; use adapters and test doubles while preserving production-ready interfaces.
- Preserve and audit historical schedule, KPI, policy, penalty, booking-status, and membership changes.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `& .\.tools\graphify.ps1 query "<question>"` when graphify-out/graph.json exists. Use `& .\.tools\graphify.ps1 path "<A>" "<B>"` for relationships and `& .\.tools\graphify.ps1 explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `& .\.tools\graphify.ps1 update .` to keep the graph current (AST-only, no API cost).
