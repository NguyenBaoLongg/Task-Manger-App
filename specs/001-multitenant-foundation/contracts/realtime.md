# Realtime Contract: Module 1

## Connection

- Transport: Socket.IO 4 at `/socket.io`.
- Authentication: `auth.accessToken` contains the same access JWT as HTTP.
- The server revalidates session and active membership on connect/reconnect; recovered transport
  state never skips authorization middleware.
- Client joins no tenant room automatically. It requests a channel and server derives room
  `tenant:{tenantId}:channel:{channelId}` only after membership/permission checks.

## Client events

### `channel:join`

Payload:

```json
{ "tenantId": "uuid", "channelId": "uuid", "lastMessageId": "uuid-or-null" }
```

Acknowledgement:

```json
{ "ok": true, "channelId": "uuid", "recovered": false }
```

On denial, acknowledgement uses the HTTP problem fields without foreign-resource metadata.

### `channel:leave`

Payload: `{ "tenantId": "uuid", "channelId": "uuid" }`.

### `message:send`

Payload matches HTTP `sendMessage`: tenant/channel, `clientMessageId`, body and optional reply.
The server persists idempotently before emitting. Acknowledgement returns the persisted message.

## Server events

### `message:created`

Payload is `ChatMessage` from OpenAPI. It is emitted only to the authorized channel room.

### `membership:revoked`

Server removes the socket from tenant rooms and disconnects it when membership/session becomes
invalid. Client must refresh membership state over HTTP before reconnecting.

## Delivery and recovery

- `clientMessageId` is unique per author/tenant and supports at-least-once client retries.
- Cursor HTTP fetch is authoritative after reconnect; Socket.IO recovery is an optimization.
- Production Redis Streams adapter may replay transport packets, but service-level idempotency
  prevents duplicate persisted messages.
- No access token, refresh token, invite token or signed media URL may appear in event logs.
