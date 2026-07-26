# Data Model: Mobile Frontend MVP

Module 5 adds client projections and transient state only. PostgreSQL remains authoritative;
these objects are not new backend tables unless a later contract change explicitly requires one.

## `AuthSession`

- `accessToken`: short-lived bearer token held in memory where possible.
- `refreshToken`: stored only through the platform secure-storage adapter.
- `accessExpiresAt`, `refreshExpiresAt`, `sessionId`: server timestamps/identity used for
  refresh and logout decisions.
- `userId`, `profileComplete`: response values from Module 1.

Rules: refresh is single-flight, token rotation replaces the previous token, logout clears all
session material and tenant-scoped caches, and a failed refresh cannot be used to submit a
mutation.

## `TenantContext`

- `tenantId`, `tenantName`.
- `membershipId`, `displayName`, `membershipStatus`.
- `permissions`: server-provided effective permission codes.
- `branchScope`: allowed branch IDs and selected branch ID, if applicable.
- `contextVersion`: local monotonic value used to invalidate in-flight requests.

Rules: it is created from `/v1/me/tenants` and server responses only. Query keys, websocket
rooms, deep-link validation and local drafts include the context. A tenant or branch switch
cannot reuse the prior scope without a fresh server authorization response.

## `ServerPage<T>`

- `items`: validated response items.
- `nextCursor`: nullable cursor from the authoritative API.
- `scopeKey`: tenant and branch context used to fetch the page.

Used for memberships, branches, action items, schedules, penalty settlements, bookings, photo
debts, channels and messages. Pagination uses server cursors and stable ordering; the client
does not fabricate totals.

## `ActionItemProjection`

- `id`, `itemType`, `state`, `businessDate`, `title`, `deadlineAt`.
- `target`, `actual`, `remaining`, `unit` when supplied by the KPI contract.
- `sourceFreshnessAt`, `deepLink`, `branchId`, `ownerMembershipId`.
- `sourceVersion` or server state version when supplied.

The badge count comes from `openCount`; local completion is never authoritative. Deep links
are re-authorized before navigation or mutation.

## `DynamicFormDraft`

- `tenantId`, `templateId`, `formVersionId`.
- `values`: bounded JSON object matching the currently rendered schema subset.
- `updatedAt`, `submissionIntentId`, `status` (`DRAFT|SUBMITTING|SUBMITTED|CONFLICT|EXPIRED`).

Drafts retain the version ID and are discarded or migrated only by an explicit server-compatible
flow. They do not replace `FormSubmission` and are cleared on tenant switch/logout.

## `MediaUploadSession`

- `tenantId`, `purpose`, `sourceType`, `sourceId`.
- `mediaId`, `contentType`, `byteSize`, `checksumSha256`.
- signed upload URL and expiry held only in memory or an encrypted short-lived adapter.
- `status` (`CAPTURED|UPLOADING|PAUSED|COMPLETING|READY|FAILED|CANCELLED`).
- `idempotencyKey` and retry count.

Rules: the session is reauthorized after resume, signed URLs are never logged or rendered as
permanent links, local binary is removed after completion/cancellation/expiry, and all media
reads use server-created authorized download URLs.

## `NotificationProjection`

- `eventId` or `effectKey`, `tenantId`, `kind`, safe display title/body.
- `sourceType`, `sourceId`, `deepLink`, `receivedAt`, `readAt`.
- optional action descriptors (`ARRIVED_PROOF`, `CANCEL_OR_RESCHEDULE`) with expiry.

The projection is deduplicated by event/effect identity and is not a business record. Payloads
must not contain tokens, signed media URLs, raw customer PII or raw chat body beyond the server’s
safe notification contract.

## `ChatChannelProjection` and `ChatMessageProjection`

- Channel: `id`, `tenantId`, `type`, `name`, `status`, branch/group scope as returned by API.
- Message: `id`, `channelId`, `authorMembershipId`, `authorDisplayName`, `body`, `createdAt`.
- Local delivery state: `PENDING|SENT|FAILED|RECONCILED`, keyed by client intent ID.

The server message ID and cursor define order. Optimistic messages are reconciled or removed on
failure; they are never treated as persisted until the API confirms them.

## `DeepLinkIntent`

- `route`, `sourceType`, `sourceId`, `tenantId`, optional `branchId`.
- `expiresAt`, `origin` (`PUSH|ACTION_ITEM|CHAT|IN_APP`).

Before presenting a target screen, the app checks session, tenant, branch, permission, current
resource state and expiry. Invalid or stale intents land on a safe error/refresh screen.

## State transitions

- Session: `SIGNED_OUT -> AUTHENTICATING -> PROFILE_CONFIRMATION -> TENANT_SELECTION -> READY`
  with `SESSION_EXPIRED` and `REAUTH_REQUIRED` failure states.
- Media: `CAPTURED -> UPLOADING -> COMPLETING -> READY`, with retryable `PAUSED|FAILED` and
  terminal `CANCELLED|EXPIRED`.
- Mutation UI: `IDLE -> SUBMITTING -> SUCCEEDED|CONFLICT|FORBIDDEN|RETRYABLE_ERROR`.
- Chat delivery: `PENDING -> SENT -> RECONCILED`, or `FAILED` with explicit retry.

## Privacy and eviction

Token material uses SecureStore; sensitive server projections use bounded cache lifetimes and
are cleared on logout, tenant switch, account suspension or refresh failure. Video/photo binary,
consent evidence and customer PII are not copied into a general-purpose cache. Screen logs use
IDs and safe problem codes only.
