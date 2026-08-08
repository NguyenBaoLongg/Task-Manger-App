# Chat Realtime Contract

Covers the socket surface for chat. The governing rule is one sentence:

> A session receives a channel's messages if and only if its member currently holds channel
> membership and read permission.

The audit found three ways that invariant broke. This contract closes each.

## Connection

Authentication happens at handshake. The connection carries the authenticated principal; it does
not carry authorization for any particular channel. Channel authorization is evaluated per join
and re-evaluated on recovery.

Each connection is placed in its member-scoped room for the tenants it belongs to. That room is
used for events addressed to a person rather than a channel — including the eviction event below.

## Client to server

### `channel:join`

Requests delivery for one channel.

Server must verify, in order:

1. The membership exists and is active.
2. The member holds `chat.read`.
3. The member currently belongs to the named channel.

All three are required. Any failure acknowledges a denial without disclosing whether the channel
exists (FR-007).

### `channel:leave`

Stops delivery for one channel on this session.

This event did not exist. Its absence is the reason a removed member kept receiving messages, and
its presence is what lets a client stop delivery without dropping the whole connection (FR-005).

Idempotent. Leaving a channel the session is not in succeeds and changes nothing.

### `message:send`

Unchanged in shape. Now requires `chat.write` in addition to active membership, matching the HTTP
route. Already implemented; stated here so the obligation is contractual rather than incidental.

## Server to client

### `message:created`

Emitted to a channel's room when a message is accepted. Payload matches the message representation
from the API contract, including attachments.

Delivery is a room broadcast, which is why room membership must track authorization rather than
connection history — a broadcast cannot re-check each recipient without paying a permission query
per member per message (D3).

### `channel:membership-revoked`

New. Emitted to the **member's** room when that member loses channel membership or read permission.

Two things happen together:

1. The server removes every live session of that member from the channel's room. This is the
   enforcement; it does not depend on the client acting.
2. The client receives the event so it can close the view and clear cached content rather than
   appearing to hang.

Emitted regardless of whether the member is currently connected. If they are not, there is nothing
to evict and the event is simply not delivered.

## Session recovery

The gateway allows a short recovery window so brief network interruptions do not lose messages.
Recovery restores the session's rooms.

**Restored rooms must be re-authorized before delivery resumes.** A member removed from a channel
during a disconnection must not have that channel's room restored (FR-006).

This was the third break in the invariant: recovery restored rooms from connection history alone,
so a revoked member who reconnected inside the window silently regained delivery.

## Multi-instance behavior

Room broadcasts propagate across API instances through the existing Redis-backed adapter, so
`message:created` already reaches sessions on other instances.

Eviction must propagate the same way. Revocation may be processed by an instance that holds none
of the victim's sessions, so removing a member from a room must not be a local-only operation
(CR-001).

## Negative cases requiring coverage

| Case | Expected |
|---|---|
| Join a channel in another tenant | Denied |
| Join without `chat.read` | Denied |
| Join a channel the member does not belong to | Denied, existence not disclosed |
| Send without `chat.write` | Denied |
| Member removed while connected | Stops receiving within the delivery target, no client action needed |
| Member removed while disconnected, reconnects inside the recovery window | Room not restored |
| Member removed on an instance holding none of their sessions | Still evicted |
| Leave, then a message is sent | Not received |
