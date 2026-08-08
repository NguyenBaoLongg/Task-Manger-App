# Phase 0 Research: Chat Hardening

No `NEEDS CLARIFICATION` markers survived the specification, so this document records the design
decisions behind each audit finding plus the sequencing analysis the plan depends on.

## D1 — Client message identity key

**Decision**: The client's deduplication key becomes the pair (author, client message id). The
optimistic entry a sender creates locally is matched to its server confirmation by that pair, not
by the client message id alone.

**Rationale**: The database declares uniqueness as `(tenant, author, client message id)`. The
client narrowed that to the client message id, so its identity model was strictly weaker than the
store's. Two authors reusing one id is legal at the database and produced silent loss at the
client — reproduced as two messages in, one message out. Aligning the client key to the stored
scope removes the whole class rather than making collisions less likely.

**Alternatives considered**:

- *Make client message ids globally unique per channel*. Rejected: it changes a shipped uniqueness
  constraint and every existing row, and it still leaves clients trusting an id chosen by a peer.
- *Key on the server message id only*. Rejected: the optimistic entry has no server id yet, which
  is the reason a client-side key exists at all.
- *Generate collision-resistant ids and accept the residual risk*. Rejected: it leaves a silent
  data-loss path open and its failure mode is invisible to the user.

## D2 — Message ordering

**Decision**: The client orders by the same composite the server indexes on — creation time, then
message id as the tiebreaker.

**Rationale**: The server's index is `(tenant, channel, created at, id)`; the client sorted by
creation time alone. Messages sharing a millisecond therefore had undefined relative order, and
two devices could legitimately disagree. Adopting the server's tiebreaker makes ordering a
property of the data rather than of sort stability.

**Alternatives considered**:

- *Rely on the array order the API returns*. Rejected: local optimistic entries must be merged
  into that list, so an explicit comparator is required regardless.
- *Add a per-channel sequence number*. Rejected: it needs a new column and a write-serialization
  point, and the existing composite already orders totally.

## D3 — Leaving a channel and revoking membership

**Decision**: Realtime room membership is derived from current authorization, not from connection
history. Three changes implement that: an explicit leave path, server-side eviction from the
channel room when membership or read permission is withdrawn, and re-authorization of restored
rooms when a recovered session resumes.

**Rationale**: The gateway joins a channel room and never leaves it. Delivery is a room broadcast,
so a removed member keeps receiving messages until they disconnect — an authorization boundary
enforced only by luck of timing. Short-window session recovery makes it worse by restoring rooms
without re-running the join check. Because revocation happens on a different connection than the
victim's, eviction has to be pushed rather than polled.

**Alternatives considered**:

- *Filter at emit time by re-checking every recipient*. Rejected: it turns one broadcast into a
  permission query per member per message, and the cost lands on the hot path.
- *Shorten or disable session recovery*. Rejected: it degrades reconnect behavior for everyone to
  work around a check that is missing rather than mistimed.
- *Let the client stop rendering messages it should not see*. Rejected outright: it leaves the
  content leaving the server, which is the actual defect.

## D4 — Unread counts

**Decision**: Unread stays derived from the existing read marker on channel membership. The read
marker only ever moves forward, and the sender's own messages never count as unread.

**Rationale**: The column already exists and no application code reads or writes it — the storage
decision was made in Module 5 and never wired up. Deriving the count keeps one source of truth and
avoids a per-message-per-member read table, which is the expensive shape and is not needed for the
declared volume. Monotonicity is required because retries and out-of-order delivery would otherwise
let a stale marker resurrect already-read messages.

**Alternatives considered**:

- *Per-message read receipts*. Rejected: it is a row per message per member, and no requirement in
  this scope asks who read what — only how many remain.
- *A counter maintained on write*. Rejected: counters drift under concurrency and need repair jobs;
  a derived count cannot drift.

## D5 — Chat attachments

**Decision**: Attachments reuse the existing media object, consent and authorized signed-access
flow, distinguished by the chat purpose value the enum already carries. Access is authorized by
channel membership.

**Rationale**: Modules 3 and 4 already run this flow for attendance video and customer proof
photos, including retention and log redaction. The purpose value for chat was declared and never
used. Reusing the flow keeps one media boundary to audit instead of two.

**Alternatives considered**:

- *A separate chat upload path*. Rejected: it would duplicate consent, retention and signed-access
  logic, and doubles the surface where a leak could appear.
- *Inline small files in the message body*. Rejected: it puts binary data in the transactional
  store and bypasses retention entirely.

## D6 — Transport parity for authorization

**Decision**: Every transport that can send or read messages applies the same permission codes.
Already implemented for the socket gateway; this feature keeps it as a stated requirement with
regression coverage rather than as a one-off fix.

**Rationale**: The HTTP routes gated on the chat read and write permissions; the socket handlers
checked only that the membership existed and was active, so the transport chosen decided the
authorization applied. Stating it as a requirement means a future transport inherits the
obligation instead of rediscovering it.

## Sequencing across the system

The user asked for the plan across the whole system, not only this module. The controlling
constraint is the Constitution's rule that a module gate opens only when no work remains.

**Current state**:

| Module | Status | What remains |
|---|---|---|
| 001 multi-tenant foundation | Delivered | — |
| 002 OKR/KPI engine | Delivered | — |
| 003 timekeeping/workflows | Delivered | — |
| 004 booking/export | Delivered | — |
| 005 mobile frontend | **Open** | 8 tasks, all requiring a native runtime |
| 006 chat hardening | Specified and planned | Implementation gated |

**The single blocker**: Module 5's eight open tasks all need Detox to execute against a device.
Detox 20.51.4 fails against React Native 0.81 in bridgeless mode — the idling-resource factory
requests a React context that the New Architecture no longer exposes, so the app disconnects
during launch. The Android emulator problem that previously masked this is resolved; the host now
boots a working Android 14 image, and the backend, database and bundler all run. The remaining
obstacle is the tooling incompatibility alone.

**Decision**: Close Module 5 before implementing Module 6.

**Rationale**: Module 6 changes the same mobile chat surface Module 5's end-to-end suite is
supposed to verify. Implementing it first means Module 5's eventual verification runs against code
Module 5 never specified, and the two modules' evidence becomes impossible to separate.

**Options for unblocking Module 5**, in the order they should be attempted:

1. *Upgrade Detox to a release that supports bridgeless mode*. Cheapest to test and preserves the
   shipping configuration. Availability is unverified; a version check is the first task.
2. *Build the end-to-end target with the New Architecture disabled*. Known to work, but the
   measured build then differs from the shipped one. Acceptable only if the verification record
   states it explicitly, and only for the criteria that are not latency measurements — the New
   Architecture exists to change performance, so latency numbers taken without it are pessimistic
   and cannot certify the shipped build.
3. *Record the eight tasks as blocked on a third-party incompatibility*. Honest, but leaves the
   module gate closed indefinitely.

Option 1 is attempted first because it is the only one that keeps the verified build and the
shipped build identical.

**Separately tracked**: the worker logs a repeated Prisma validation failure on its tick. It does
not block chat or the mobile end-to-end path, so it is not folded into this feature, but it should
not be lost — it belongs in Module 5's remaining defect list, not here.
