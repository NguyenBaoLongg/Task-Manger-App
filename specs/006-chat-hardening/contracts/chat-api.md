# Chat API Contract

Extends the Module 1 chat surface. Existing channel and message operations keep their current
shape; this document records only what changes or is added.

The source of truth for the shipped operations remains the Module 1 OpenAPI document. Nothing here
weakens an existing contract.

## Conventions

- `Authorization: Bearer <accessToken>` on every operation.
- The tenant identifier in the path must have come from the authenticated membership response.
- Mutations carry `Idempotency-Key`.
- Errors use `application/problem+json` with `{ code, message, correlationId }` and never expose
  storage paths, object keys or personal data (FR-017).
- Every operation is authorized by **current** membership and permission, re-evaluated per request.

## Permission codes

| Operation | Required |
|---|---|
| Read channels, messages, unread counts | `chat.read` |
| Send a message, upload an attachment | `chat.write` |
| Create or administer a channel | `chat.manage` |

These codes apply identically on every transport. A transport that cannot evaluate them must not
expose the operation (FR-007, CR-002).

## Changed operations

### Send a message

`POST /v1/tenants/{tenantId}/channels/{channelId}/messages`

Adds optional attachment references to the existing request. Text-only sends are unchanged, so
existing clients keep working.

Request adds:

| Field | Rules |
|---|---|
| `attachments` | Optional list of media object references already uploaded and `READY`. Bounded length. Omitted or empty means a text-only message. |

Response adds the resolved attachment list. Each entry carries the media reference and its
availability, never a storage path or object key.

Behavior:

- The message and its attachment bindings are one atomic effect (CR-003).
- Retrying with the same `clientMessageId` returns the original message. Retrying that id with a
  different body or a different attachment set is a conflict, matching the existing rule for body.
- A referenced media object that is not `READY`, not owned by the caller, or not of the chat
  attachment purpose is rejected before the message is created (FR-015).

### List messages

`GET /v1/tenants/{tenantId}/channels/{channelId}/messages`

Unchanged except that each item now carries its attachment list, and the contract now states the
ordering guarantee explicitly.

**Ordering**: items are returned in ascending `(createdAt, id)`. `createdAt` alone is not a total
order and consumers must not sort by it alone (FR-002).

**Identity**: `clientMessageId` is unique per `(tenant, author)` only. Consumers must key any
deduplication on the author together with the client message id (FR-001). This was previously
implicit and is now contractual.

## New operations

### Mark read

`PUT /v1/tenants/{tenantId}/channels/{channelId}/read-marker`

Moves the caller's read marker in the named channel.

Request: the message identifier read up to.

Behavior:

- Forward-only. Naming a message at or behind the current marker succeeds and changes nothing,
  so retries and out-of-order arrivals are safe (FR-010).
- The message must belong to the named channel.
- Idempotent. Repeating the request produces the same state.
- The updated unread count is returned so the caller does not need a second round trip.

### Unread summary

`GET /v1/tenants/{tenantId}/chat/unread`

Returns the caller's unread count per channel plus the total, for the badge.

Behavior:

- Counts messages newer than the caller's read marker in `(createdAt, id)` order.
- Excludes messages the caller authored (FR-011).
- Excludes channels the caller has left.
- Derived per request; never a stored counter (D4).

### Leave a channel

`DELETE /v1/tenants/{tenantId}/channels/{channelId}/members/me`

Ends the caller's membership in the channel.

Behavior:

- Sets the membership end and evicts every live session of that member from the channel's realtime
  room as part of the same transition, not as later cleanup (FR-005).
- Idempotent. Leaving a channel already left succeeds and changes nothing.

## Attachment upload

No new upload endpoint. Chat reuses the existing media upload flow with the chat attachment
purpose, which already carries consent, retention, signed access and log redaction (D5).

Read access to a chat attachment is authorized by current channel membership. A member who has
left loses access even to attachments they could previously open (FR-014).

## Negative cases requiring coverage

Each maps to a tenant-isolation or authorization test (CR-001, CR-006):

| Case | Expected |
|---|---|
| Any operation with a tenant the caller has no membership in | Denied, no data disclosed |
| Send without `chat.write` | Denied on every transport |
| Read without `chat.read` | Denied on every transport |
| Read marker naming a message in another channel | Rejected |
| Read marker naming a message behind the current marker | Accepted, no change |
| Attachment fetch by a non-member | Denied, no storage path returned |
| Attachment fetch by a member who has since left | Denied |
| Send referencing another member's media object | Rejected |
