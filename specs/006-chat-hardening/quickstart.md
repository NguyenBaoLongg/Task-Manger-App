# Quickstart: Chat Hardening

Validation guide for Module 6. It proves the two defect fixes and the two new capabilities against
a real API, database and client. No production credentials are required.

Contract details live in [contracts/chat-api.md](./contracts/chat-api.md) and
[contracts/chat-realtime.md](./contracts/chat-realtime.md); entity rules live in
[data-model.md](./data-model.md). This document does not repeat them.

## Prerequisites

- Node.js `>=24` with Corepack.
- PostgreSQL reachable at the repository's `DATABASE_URL`. A native service is sufficient; Docker
  is not required.
- Migrations applied and the deterministic seed loaded.
- API and worker running.
- Two seeded accounts in one tenant that both belong to one channel, and one account in a second
  tenant for isolation checks.

## Prepare backend

From the repository root:

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm dev:api
corepack pnpm dev:worker
```

The seed and migrations are idempotent, so re-running them is safe.

> Environment note: the API, worker and seed read configuration from the process environment
> rather than loading a `.env` file themselves. Export the repository's local values into the
> shell before starting them, or the process exits on a configuration validation error.

Confirm readiness before continuing — the readiness signal reports database connectivity, and a
failure here will otherwise surface later as a confusing client error.

## Start mobile

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"
corepack pnpm --filter @adsup/mobile start
```

For an emulator or physical device, reverse-forward the API port or use a LAN-reachable URL. The
base URL has no `/api` segment; the API mounts its routes under `/v1`.

## Validation scenarios

### 1. Two authors, one client message id — no message is lost

The defect this feature exists for. Have both seeded accounts send a message to the same channel
using an **identical** client message id. This is legal: the id is unique per author, not per
channel.

Expect: both messages are stored, and a recipient's list shows **both**. Before the fix this
produced two messages in and one message out.

Repeat with the same author reusing their own id and an identical body — expect the original
message returned, not a second one.

### 2. Ordering is total and agrees across devices

Send several messages fast enough to share a creation millisecond. Open the channel on two
devices.

Expect: identical order on both, matching the server's order. Sorting by creation time alone would
leave the tied messages in arbitrary relative order.

### 3. Removal stops delivery immediately

Sign in as the first account and open the channel, keeping the connection live. From an authorized
account, remove that member from the channel. Send a new message.

Expect: the removed member's device receives nothing, without the user closing the app or the
connection dropping. Their view reports the loss of access rather than appearing to hang.

Repeat with permission revocation instead of channel removal — expect the same outcome.

### 4. Recovery does not restore revoked access

With the first account connected, interrupt its network. While it is disconnected, remove it from
the channel. Restore the network inside the recovery window and send a message.

Expect: the channel room is not restored and no message arrives. This is the case that
authorization-by-connection-history gets wrong.

### 5. Unread counts and the read marker

With the first account not viewing the channel, send several messages from the second. Check the
first account's unread summary.

Expect: an accurate per-channel count and total. Messages the first account sent itself are not
counted.

Mark read up to the latest message. Expect the count to reach zero, and a second signed-in device
of the same account to reflect it.

Send the read marker again naming an **older** message. Expect success with no change — the marker
never moves backward.

### 6. Attachments

Send a message with an image attached. Expect channel members to see the message with its
attachment.

From an account outside the channel, request the attachment. Expect a safe denial with no storage
path or object key in the response or logs.

Have a member leave the channel, then request an attachment they could previously open. Expect a
denial.

Interrupt an upload and retry it. Expect exactly one message and no unreferenced media object.

### 7. Cross-tenant isolation

Using the second tenant's account, attempt each of: reading the first tenant's channel messages,
setting a read marker on its channel, joining its realtime room, and fetching its attachment.

Expect: every attempt denied, with no disclosure of whether the channel or message exists.

## Automated gates

Run before marking any task complete:

```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:contract
corepack pnpm test:integration
corepack pnpm test:migration
corepack pnpm --filter @adsup/mobile test
```

Every scenario above must also exist as an automated test, not only as a manual walkthrough
(CR-006). Manual execution of this guide is evidence that the scenarios are runnable, not a
substitute for the suites.

## Recording results

Record command output and per-scenario outcomes in `specs/006-chat-hardening/verification.md`.
State explicitly which scenarios ran against a native build and which ran against the API and
Jest only — the distinction matters for the delivery gate and must not be left implicit.
