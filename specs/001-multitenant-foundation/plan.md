# Implementation Plan: Nền tảng SaaS đa tenant

**Branch**: `001-multitenant-foundation` (logical feature) | **Date**: 2026-07-19 |
**Spec**: [spec.md](./spec.md)

**Input**: Module 1 establishes the backend/database contracts that every Adsup module will consume.

## Summary

Build a TypeScript monorepo foundation with a stateless Express API, PostgreSQL/Prisma,
Google identity onboarding, revocable sessions, tenant/branch organization, membership RBAC,
versioned dynamic forms, tenant-scoped chat, notification endpoints, signed media flows,
append-only audit, idempotency, and deterministic seed data. Domain/service boundaries derive
tenant scope from authenticated context and expose stable OpenAPI contracts before Module 2.

## Technical Context

**Language/Version**: Node.js 24 LTS, TypeScript 5.9+, ESM

**Primary Dependencies**: Express 5, Prisma 7, `@prisma/adapter-pg`, Zod, Ajv 2020,
`jose`, `google-auth-library`, Socket.IO 4, Redis/node-redis, Redis Streams adapter,
AWS SDK v3 S3 client/presigner, Pino

**Storage**: PostgreSQL 16+ authoritative database; JSONB for validated form schemas/data;
S3-compatible object storage for binary media; Redis for ephemeral realtime/distributed state

**Testing**: Vitest, Supertest, Prisma local Postgres (`prisma dev`), contract validation,
negative tenant-isolation integration tests, deterministic seed/migration checks, k6 load smoke

**Target Platform**: Stateless Linux/Windows-compatible Node services; local development on
Windows without Docker; production behind TLS/load balancer with managed Postgres/Redis/S3

**Project Type**: TypeScript monorepo containing API, worker shell, shared domain/database/
contract/config/testing packages; native mobile is a downstream module

**Performance Goals**: 200 API requests/second target with p95 <500 ms for non-media
operations; 2,000 concurrent Socket.IO connections; no binary proxying through the API

**Constraints**: Strict tenant and branch authorization; no `ADMIN_IDS`; no Telegram,
Google Sheets, or Local Storage as authority; retry-safe mutations/jobs; append-only history;
cloud credentials optional locally; one active feature/module

**Scale/Scope**: 100 tenants, 500 branches, 10,000 accounts, 30-member deterministic sample
tenant; foundational entities/contracts only—no KPI, attendance, penalties, booking, or mobile UI

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- [x] Every tenant-owned data path is tenant-scoped in schema, authorization, constraints,
      indexes, cache/storage keys, workers, realtime rooms, and negative isolation tests.
- [x] Identity and permissions come from authenticated membership/RBAC/branch scope; the
      backend remains authoritative and no hard-coded administrator IDs are introduced.
- [x] Historical business state is versioned or append-only, audited, transaction-safe, and
      idempotent under retries and concurrent requests.
- [x] Shared schemas and contracts are explicit; dynamic JSONB is schema-versioned; S3,
      Redis, Socket.IO, FCM, and APNs are behind testable adapters.
- [x] Unit, contract, integration, tenant-isolation, migration, typecheck, lint, and build
      gates are planned with traceability to requirements.
- [x] Observability, privacy/consent, retention, backup/restore, capacity targets, and
      credential-free local testing are addressed where the feature touches them.

## Architecture Decisions

### Request and authorization flow

1. Correlation middleware establishes a server-generated/request-safe correlation ID.
2. Authentication verifies access JWT and resolves the global user/session.
3. Tenant context resolves `tenant_id` from the route plus an active membership; it never
   accepts an actor or tenant identity from request body data.
4. Authorization evaluates permission + binding scope + effective assignment requirements.
5. Zod validates transport payloads; Ajv validates dynamic form schema/submission data.
6. Service methods open transactions, execute tenant-aware repositories, audit changes, and
   finalize idempotency records before returning.

### Package boundaries

- `packages/domain`: framework-independent entities, policies, ports, error codes, tenant
  context, authorization and idempotency semantics.
- `packages/database`: Prisma schema/client, migrations, tenant-aware repositories and seed.
- `packages/contracts`: OpenAPI source, shared request/response schemas and generated-safe types.
- `packages/config`: environment parsing and secret-safe configuration.
- `packages/testing`: fake Google/object storage/push providers and test factories.
- `apps/api`: Express composition root, HTTP middleware/controllers and Socket.IO gateway.
- `apps/worker`: composition shell for future retry-safe background processors; no Module 2 logic.

### Tenant isolation strategy

- Root/global tables are limited to User, ExternalIdentity, AuthSession, PermissionCatalog,
  NotificationEndpoint, SecurityEvent and account-level idempotency.
- Every tenant-owned table contains `tenant_id`; parent/child relations use composite keys
  where practical so a child cannot point to a parent in another tenant.
- Repository functions require `TenantContext`; direct Prisma use is limited to database
  adapters/composition and seed/migration tooling.
- Object keys, Socket.IO room names, Redis keys and job identifiers start with tenant scope.
- Cross-tenant requests use the same not-found/forbidden-safe problem response and never
  reveal existence.

### Transaction and concurrency boundaries

- Tenant creation atomically creates tenant, owner membership, system roles/bindings and audit.
- Invite acceptance atomically locks/validates invite use, creates membership/bindings and
  increments use count; unique constraints prevent duplicate membership.
- Role/membership changes enforce last-owner invariant inside a transaction.
- Form publication reserves the next version number and freezes schema in one transaction.
- Media completion verifies object metadata before the READY transition and is idempotent.
- Idempotency key + request hash unique constraints serialize duplicate mutation intent.

### Infrastructure adapters

- Google verifier, object storage, push provider, realtime backplane, clock and ID generator
  are ports with production and in-memory/test implementations.
- S3 presigned PUT/GET is five minutes and signs content type/checksum; no cloud secret reaches clients.
- Socket.IO local mode uses memory; production uses Redis Streams with tenant/channel rooms
  and re-authorization on every connection/reconnection.
- Push endpoints are persisted now; notification business commands belong to owning modules.

### Observability and error contract

- `application/problem+json` includes `type`, `title`, `status`, `code`, `detail`,
  `correlationId` and optional field errors; secrets and foreign-resource existence are removed.
- Pino structured logs bind correlation, tenant and actor IDs only after verified context.
- `/health/live`, `/health/ready` and dependency status expose no credentials.
- Metrics capture request duration/status, auth/authorization denials, idempotency replay,
  realtime connections and adapter failures.

## Requirement-to-Verification Strategy

| Requirement area | Verification |
|---|---|
| FR-001–FR-006 identity/tenant entry | unit + auth contract + integration + replay tests |
| FR-007–FR-012 organization/RBAC | service unit + authorization matrix + cross-tenant integration |
| FR-013–FR-015 dynamic forms | JSON Schema unit + publish/submission integration + history checks |
| FR-016–FR-017 chat/push endpoints | Socket.IO/HTTP contract + membership denial + retry tests |
| FR-018–FR-019 media | adapter unit + signed-flow contract + tenant/source denial tests |
| FR-020–FR-024 audit/idempotency/errors | integration + immutable audit + fingerprint conflict tests |
| FR-025 operations | health/readiness/secret-redaction tests |
| FR-026 seed | three-run deterministic database test |
| CR-001–CR-004 constitution/security | negative isolation, authz, audit and secret scanning gates |
| CR-005 capacity | k6 smoke profile and documented full target profile |
| CR-006 quality | root typecheck/lint/test/build/migrate/quickstart commands |

## Project Structure

### Documentation (this feature)

```text
specs/001-multitenant-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   ├── requirements.md
│   └── architecture.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── bootstrap/
│   │   ├── http/
│   │   ├── modules/
│   │   ├── realtime/
│   │   └── observability/
│   └── tests/
│       ├── contract/
│       ├── integration/
│       └── unit/
└── worker/
    └── src/

packages/
├── config/src/
├── contracts/src/
├── database/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   └── src/
├── domain/src/
└── testing/src/

tests/
├── load/
└── migration/
```

**Structure Decision**: A workspace monorepo separates framework-independent policy from
Prisma and delivery adapters. Only `apps/api` and `apps/worker` are deployable; packages are
private workspace libraries. This prevents downstream modules from bypassing tenant-aware
domain/service boundaries while keeping one version and one root quality gate.

## Phase 0 Output

- [research.md](./research.md) resolves runtime, database, tenant, auth, forms, media,
  realtime, audit/idempotency and testing decisions with primary references.
- No unresolved technical unknown remains.

## Phase 1 Output

- [data-model.md](./data-model.md) specifies root and tenant-owned entities, composite
  relationships, lifecycle and transaction invariants.
- [contracts/openapi.yaml](./contracts/openapi.yaml) is the stable Module 1 HTTP contract.
- [quickstart.md](./quickstart.md) is the runnable migration/seed/API/tenant-isolation guide.

## Post-Design Constitution Re-check

- Tenant isolation is represented in every entity, repository boundary and contract path.
- Global-table exceptions are explicit and contain no tenant-owned business records.
- All privileged state transitions have audit, idempotency and transaction requirements.
- Cloud/realtime providers are ports with local test doubles.
- Required verification layers and capacity/retention/observability gates are mapped.
- **Result**: PASS. No violation requires Complexity Tracking.

## Complexity Tracking

No constitutional violations or unjustified complexity exceptions.
