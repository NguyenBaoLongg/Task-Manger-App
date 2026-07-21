---
name: design-multitenant-architecture
description: "Design and implement the backend and database foundation for a multi-tenant mobile SaaS using Node.js, Express, PostgreSQL, dynamic JSONB forms, tenant-scoped RBAC, JWT authentication, object storage, realtime chat, and push notifications. Use when establishing or changing the system architecture, tenant isolation, schemas, authentication, authorization, infrastructure adapters, or foundational migrations."
---

# Design Multi-tenant Architecture

Read [the architecture requirements](references/Skill_01_Architecture_MultiTenant.md) before changing foundational code.

## Workflow

1. Inspect the repository, project constitution, current Spec Kit feature, and existing stack.
2. Preserve the existing backend stack when present. For a new backend, default to TypeScript, Node.js, Express, PostgreSQL, and Prisma unless the user chooses another listed ORM.
3. Model tenants, users, memberships, roles, permissions, role bindings, form templates, form submissions, media objects, notification endpoints, and audit fields.
4. Put `tenant_id` on every tenant-owned table. Enforce tenant scope in repository/service boundaries, indexes, unique constraints, foreign keys, tests, and authorization. Consider PostgreSQL row-level security as defense in depth.
5. Store dynamic form definitions as versioned JSON schema and submissions as PostgreSQL JSONB. Preserve the template version used for every submission.
6. Use JWT authentication without `ADMIN_IDS`. Resolve permissions through tenant membership and RBAC.
7. Hide S3-compatible storage, Socket.io, FCM, and APNs behind adapters. Keep secrets out of source control.
8. Generate migrations, seed data only when useful, validation, service/controller boundaries, and tenant-isolation tests.
9. Document architecture decisions and environment variables without embedding credentials.

## Safety and Quality Gates

- Prevent cross-tenant identifiers from being trusted directly from client payloads.
- Use transactions for membership, role, permission, and schema-version changes.
- Validate JSON schema and JSONB payloads before persistence.
- Require signed upload/download flows and media authorization.
- Treat unresolved citation markers such as `[2]` or `[3]` as labels, not verified sources, until URLs are supplied.
- Do not add Telegram, Google Sheets, or Local Storage as system dependencies.

## Completion

Return the schema and migration summary, API/infrastructure boundaries, tenant-isolation strategy, tests run, and any decisions that must be encoded into Spec Kit artifacts before the next module.
