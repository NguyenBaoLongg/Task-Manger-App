# Implementation Plan: Chat Hardening and Delivery Integrity

**Branch**: `006-chat-hardening` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-chat-hardening/spec.md`

## Summary

Close six defects found by auditing the chat feature shipped in Module 5, then complete the two
capabilities whose storage already exists but whose behavior does not.

Two defects lose or leak data and drive the design:

- The mobile reconciler dedupes on the client message id alone, while the database scopes that
  id per author. Two authors reusing one id collapse into one row and a message disappears.
  The fix is to make the client's identity key match the database's uniqueness scope.
- The realtime layer has no leave path, so a member removed from a channel keeps receiving its
  messages until they disconnect, and short-window session recovery restores their rooms without
  re-authorizing. The fix is to make room membership a function of current authorization rather
  than of connection history.

The remaining work is additive and reuses infrastructure already proven by Modules 3 and 4:
unread counts derive from the existing read marker column, and chat attachments reuse the
existing media object, consent and signed-access flow.

## Technical Context

**Language/Version**: TypeScript on Node.js `>=24.0.0`

**Primary Dependencies**: Express 5, Prisma 7, Socket.io 4 with the Redis Streams adapter,
Zod 4, React Native 0.81 with Expo 54, TanStack Query

**Storage**: PostgreSQL as the authoritative store; S3-compatible object storage behind an
adapter for attachments; Redis for the realtime backplane when running more than one instance

**Testing**: Vitest for backend unit, contract and integration suites; Jest with `jest-expo`
for mobile; Detox for native end-to-end

**Target Platform**: Node.js API and worker on Linux or Windows; Expo development build on
Android and iOS

**Project Type**: Multi-tenant SaaS monorepo — Express API plus worker plus React Native client

**Performance Goals**: A sent message reaches a connected recipient in under 3 seconds on a
normal network profile in at least 19 of 20 runs (SC-009). Loss of channel membership stops
delivery within 10 seconds (SC-003).

**Constraints**: No end-to-end encryption, calls, full-text search, reactions, or message
edit/delete in this scope (FR-018). Chat remains a supporting feature and never becomes the
system of record. Acceptance must run without live AWS, FCM or APNs credentials.

**Scale/Scope**: Mid-size enterprise volume — tens of thousands of messages per tenant, not
public social-network scale. Four backend surfaces change (chat service, chat routes, socket
gateway, media authorization) plus the mobile chat feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Every tenant-owned data path is tenant-scoped in schema, authorization, constraints,
      indexes, cache/storage keys, workers, realtime rooms, and negative isolation tests.
- [x] Identity and permissions come from authenticated membership/RBAC/branch scope; the
      backend remains authoritative and no hard-coded administrator IDs are introduced.
- [x] Historical business state is versioned or append-only, audited, transaction-safe, and
      idempotent under retries and concurrent requests.
- [x] Shared schemas and contracts are explicit; dynamic JSONB is schema-versioned; S3,
      Redis, Socket.io, FCM, and APNs are behind testable adapters.
- [x] Unit, contract, integration, tenant-isolation, migration, typecheck, lint, and build
      gates are planned with traceability to requirements.
- [x] Observability, privacy/consent, retention, backup/restore, capacity targets, and
      credential-free local testing are addressed where the feature touches them.

### Post-design re-check

All six items still hold after Phase 1. Two design decisions were made specifically to keep
them holding, and both are recorded in [research.md](./research.md):

- Room membership is re-derived from current authorization on every join and on every session
  recovery, so principle I and II are enforced by the realtime layer rather than assumed by it.
- Attachment access reuses the existing authorized signed flow instead of introducing a chat
  specific storage path, so principle IV and VI keep one media boundary rather than two.

### Delivery workflow gate — NOT SATISFIED

The Constitution's *Delivery Workflow and Quality Gates* section states that work must keep one
active Spec Kit feature and one active product module at a time, and that a module gate opens
only when tests, typecheck, lint, build and convergence report no remaining work.

**Module 5 is not closed.** Its task list stands at 127 complete and 8 open (T107, T111, T114,
T118, T119, T132, T133, T135). Every one of them needs a working native Android or iOS runtime,
and native end-to-end execution is currently blocked by an incompatibility between Detox 20.51.4
and React Native 0.81 running the New Architecture in bridgeless mode.

Two consequences follow, and they are deliberately recorded rather than worked around:

1. `.specify/feature.json` now points at `specs/006-chat-hardening`. The active feature moved
   off Module 5 while Module 5 still has open work. This plan does not treat that as permission
   to implement Module 6.
2. The Constitution names five modules in dependency order and ends at the mobile frontend.
   Module 6 is an extension beyond that declared order, so the order itself needs an amendment
   before Module 6 can be delivered under it.

**Ruling**: specification and planning for Module 6 may proceed, because they produce no code
and no schema change. `/speckit-implement` for Module 6 MUST NOT start until either Module 5's
gate closes or the Constitution is amended with a documented rationale. The recommended path is
to close Module 5 first; see [research.md](./research.md) for the sequencing analysis.

## Project Structure

### Documentation (this feature)

```text
specs/006-chat-hardening/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── chat-api.md
│   └── chat-realtime.md
├── checklists/
│   └── requirements.md  # Written by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
apps/api/src/
├── modules/chat/
│   ├── chat-service.ts          # send; gains read-marker, unread and attachment binding
│   └── chat-routes.ts           # gains read-marker and unread endpoints
├── realtime/
│   ├── socket-gateway.ts        # gains leave, membership revocation, recovery re-authorization
│   └── backplane.ts             # gains the membership-revoked event envelope
└── modules/media/               # existing authorized signed flow, extended with a chat purpose

apps/worker/src/                 # unchanged by this feature

packages/database/
├── prisma/schema.prisma         # ChatMessage gains an attachment relation; no new chat tables
└── src/                         # chat repository gains read-marker and unread queries

apps/mobile/src/features/chat/
├── chat-realtime.ts             # reconciler identity key and ordering corrected
├── chat-queries.ts              # read-marker, unread and attachment calls
└── chat-composer.ts             # attachment selection and validation

apps/api/tests/                  # contract, integration and tenant-isolation coverage
apps/mobile/tests/               # unit, integration and accessibility coverage
```

**Structure Decision**: The existing monorepo layout is kept unchanged. This feature adds no new
package and no new application. It modifies four backend files, one Prisma relation, the chat
repository, and the mobile chat feature directory, because every capability it needs already has
a home in the current structure.

## Complexity Tracking

> Filled because the delivery workflow gate above is not satisfied.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Planning Module 6 while Module 5 has 8 open tasks | The two chat defects lose messages and leak them to removed members. Both are live in the shipped code. Recording the design while the audit evidence is fresh costs nothing and changes no code. | Waiting for Module 5 to close was rejected only for the *planning* step, not for implementation. Module 5's remaining work is blocked on a third-party tooling incompatibility with no committed fix date, so blocking the write-up would strand the audit findings indefinitely. Implementation still waits. |
| Module 6 falls outside the Constitution's five-module order | The order was written for initial delivery and ends at the mobile frontend. Post-delivery defect remediation has no declared slot. | Folding this work into Module 5 was rejected because Module 5's spec scopes chat as build-only; these are corrections to delivered behavior plus two new capabilities, which would silently expand a module whose gate is already being measured. |
