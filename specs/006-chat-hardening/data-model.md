# Phase 1 Data Model: Chat Hardening

This feature adds no new chat table. It activates one existing column, adds one relation, and
tightens two client-side invariants. Everything below is tenant-scoped; `tenant` is the leading
component of every key and index, per Constitution principle I.

## Existing entities — unchanged shape

### Chat Channel

A conversation inside one tenant.

| Field | Notes |
|---|---|
| tenant, id | Composite identity |
| type | Tenant-wide, branch, or group |
| name | Display name |
| branch | Optional; present when the channel is scoped to one branch |
| status | Active or archived |
| created by, created at, updated at | Provenance |

Rules: a channel scoped to a branch is visible only to members whose scope includes that branch.
An archived channel accepts no new messages and no new attachments.

### Channel Membership

The relation between a member and a channel. **This entity carries the read marker this feature
activates.**

| Field | Notes |
|---|---|
| tenant, channel, member | Composite identity |
| role | Member or moderator |
| joined at | Provenance |
| left at | Set when the member leaves or is removed; null while active |
| **last read message** | **Exists today and is referenced by no code. This feature gives it behavior.** |

Rules:

- The read marker moves **forward only**. A request naming an older message than the current
  marker is accepted and changes nothing, so retries and out-of-order delivery are safe (FR-010).
- The marker must name a message in the same channel. A marker pointing at a deleted message stays
  valid for counting purposes.
- Setting `left at` ends delivery immediately, not at the next reconnect (FR-004).

### Chat Message

| Field | Notes |
|---|---|
| tenant, id | Composite identity |
| channel | Owning channel |
| author | Sending membership |
| author display name snapshot | Frozen at send time |
| **client message id** | **Unique per `(tenant, author)` — not per channel and not per tenant** |
| body | Text, 1 to 4000 characters |
| message type | Text or system |
| reply to | Optional |
| created at, edited at, deleted at | `edited at` and `deleted at` stay unused; edit and delete are excluded by FR-018 |

**The uniqueness scope is the pivotal fact of this feature.** Because the client message id is
unique only per author, any consumer that treats it as a standalone identity will merge two
authors' messages and lose one. That is exactly the defect reproduced in the audit.

Ordering: total order is `(created at, id)`. Creation time alone is not a total order and must
never be used as one (FR-002).

## New relation

### Message Attachment

Binds an existing media object to a message. No new storage entity — the media object, its
consent record, its retention policy and its signed-access path all exist and are reused (D5).

| Field | Notes |
|---|---|
| tenant, message | Owning message |
| media object | Reference to the existing media entity |
| ordinal | Position when a message carries several attachments |

Rules:

- The media object's purpose must be the chat attachment value the enum already declares.
- Read access is authorized by **current** channel membership, evaluated at request time — never
  by the fact that the requester once saw the message (FR-014, CR-004).
- A message and its attachments are created as one effect. An interrupted upload that is retried
  must not leave a second message or an unreferenced media object (FR-015, CR-003).
- Retention deleting a media object leaves the message readable with the attachment marked
  unavailable; it does not delete the message.

## Derived values

### Unread count

Not stored. Computed per member per channel as the number of messages in the channel that are
newer than the member's read marker, in the total order `(created at, id)`, excluding messages the
member authored (FR-008, FR-011).

Consequences of deriving rather than storing:

- The value cannot drift out of sync with the messages, so no repair job is needed.
- A member with no read marker has every message in the channel unread except their own.
- The badge total is the sum across channels the member currently belongs to. Channels the member
  has left contribute nothing.

## Realtime state — not persisted

### Session Room Membership

Which channel rooms a connected device currently receives. Held by the realtime layer, not the
database, but it is state and it is the subject of the second defect.

Invariant: **a session receives a channel's messages if and only if its member currently holds
channel membership and read permission.** The audit found three ways that invariant broke — no
leave path, no eviction on revocation, and session recovery restoring rooms without re-checking.
Each is closed by FR-004, FR-005 and FR-006 respectively.

## State transitions

Channel membership:

```text
(none) --join--> ACTIVE --leave or removal--> LEFT --rejoin--> ACTIVE
```

`ACTIVE -> LEFT` must evict every live session of that member from the channel room as part of the
transition, not as a later cleanup step.

Attachment upload:

```text
PENDING_UPLOAD --success--> READY --retention--> DELETED
              \--failure or abandonment--> REJECTED
```

A message becomes visible only once its attachments are `READY`, so a recipient never sees a
message referencing a file they cannot open.

## Tenant isolation checkpoints

Every one of these needs a negative test (CR-001, CR-006):

- Reading messages, unread counts or attachments across a tenant boundary.
- Setting a read marker on another tenant's channel membership.
- Joining a realtime room for a channel in another tenant.
- Requesting an attachment belonging to a channel the requester does not currently belong to.
- Receiving a message in a channel the requester was removed from moments earlier.
