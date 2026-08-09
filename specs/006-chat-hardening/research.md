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
| 005 mobile frontend | **Open** | Documentation of results; no work is blocked |
| 006 chat hardening | Specified and planned | Implementation gated |

**Correction to an earlier version of this document.** This section previously stated that Module
5's eight open tasks were blocked by an incompatibility between Detox 20.51.4 and React Native
0.81 in bridgeless mode, and ranked three options for working around it. That diagnosis was wrong
and has been withdrawn. Detox 20.51.4 supports the New Architecture: `getCurrentReactContext`
branches on `isFabricEnabled()` and reads `reactHost.currentReactContext` on the bridgeless path.

The real cause was one layer down and had nothing to do with Detox. Following the symptom through:

| Layer | What it reported |
|---|---|
| Detox | `ReactContext is null` |
| React Native | `Unable to load script` — the JS bundle never loaded |
| App | Looked for Metro at `10.0.2.2:8081`, the emulator's host alias |
| Emulator network | `ping 10.0.2.2` → `Network is unreachable` |
| Interfaces | `eth0` and `wlan0` absent from `ip -br addr`; only loopback present |

The emulator booted with a dead network stack, so nothing could reach the bundler. Restarting the
emulator restored `eth0` and `wlan0` and the whole chain worked. `adb reverse` was never involved —
the app chooses the `10.0.2.2` alias on its own, so the tunnels set up earlier were never used.

The lesson worth keeping: the topmost error named the wrong component. Three layers of plausible
blame — Detox, then the New Architecture, then the bundler — sat above a host networking failure.

**Outcome**: with the network fixed the Detox suite ran and exposed three test defects that had
never been observable, all now fixed. The suite stands at 7 suites and 10 tests passing on
Android 14 against the seeded Module 1-4 API, and SC-001 measured 20/20 under its 60s limit.

**Decision**: Close Module 5 before implementing Module 6.

**Rationale**: Module 6 changes the same mobile chat surface Module 5's end-to-end suite is
supposed to verify. Implementing it first means Module 5's eventual verification runs against code
Module 5 never specified, and the two modules' evidence becomes impossible to separate. This
rationale is unaffected by the correction above — only the reason Module 5 was still open changed,
not the ordering argument.

**Separately tracked, now resolved**: the worker logged a repeated Prisma validation failure on
every tick. It turned out to be more serious than "does not block chat" suggested.

`claimDayRun` and `claimMonthRun` accept `leaseOwner`, `now` and `leaseDurationMs` alongside the
job-run columns and forwarded the whole object to `ensureDayRun`/`ensureMonthRun`, which spread it
into Prisma's `create`. TypeScript allowed it because excess-property checking applies to object
literals, not to a variable widened at the call site. `now` and `leaseDurationMs` are not columns,
so every attendance tick threw.

The attendance scheduler runs **before** the outbox dispatcher in the same tick, so the throw meant
the dispatcher never ran at all. The outbox had 85 events stranded in `PENDING`, the oldest from
2026-07-26 — no realtime action-item update, KPI progress event or push notification had been
delivered since. After the fix the queue drained to 0 pending and 88 sent, and the first
`attendance_job_runs` rows were created.

The existing unit test did not catch it because its `upsert` mock ignored its arguments entirely.
A regression test now asserts the exact `create` key set for both methods.
