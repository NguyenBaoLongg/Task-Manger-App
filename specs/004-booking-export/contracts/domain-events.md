# Domain Event Contracts: Booking

All events use the shared transactional outbox envelope:

```json
{
  "eventId": "uuid",
  "eventType": "booking.arrived.v1",
  "schemaVersion": 1,
  "tenantId": "uuid",
  "branchId": "uuid-or-null",
  "aggregateType": "BOOKING",
  "aggregateId": "uuid",
  "occurredAt": "2026-07-24T03:00:00.000Z",
  "correlationId": "opaque",
  "actorMembershipId": "uuid-or-null",
  "payload": {}
}
```

Consumers MUST validate schema, scope all reads by envelope tenant, dedupe by `(tenantId,eventId)`
and log only IDs/safe codes.

## Events

### `booking.created.v1`

Payload: booking ID, branch ID, type, scheduled start, business date, assigned membership ID,
service ID and form version ID. No customer PII.

### `booking.status-changed.v1`

Payload: booking ID, branch ID, from/to status, transition ID, reason code snapshot and state
version.

### `booking.arrived.v1`

Payload: booking ID, branch ID, customer ID, assigned membership ID, consent ID, business date and
boolean `hasReadyCustomerPhoto`.

### `booking.customer-photo-ready.v1`

Payload: booking ID, branch ID, customer ID, media object ID and optional photo debt ID.

### `booking.photo-debt-changed.v1`

Payload: debt ID, booking ID, branch ID, owner membership ID, from/to state, action item ID and
business date.

### `booking.tour-completed.v1`

Payload: tour completion ID, booking ID, branch ID, performed-by membership ID, service ID,
business date and completion timestamp. This is the authoritative Module 2 KPI source event.

### `booking.rescheduled.v1`

Payload: source booking ID, replacement booking ID, branch ID, reason code snapshot, old/new start
and assigned membership IDs.

### `booking.report-ready.v1`

Payload: report run ID, report type, business date, branch scope, content hash and destination count.

### `export.ready.v1`

Payload: export ID, requester membership ID, format `XLSX`, media object ID, row count, byte size,
checksum and expiry. No signed URL.

### `media.retention-deleted.v1`

Payload: media object ID, source type/ID, purpose, tombstone ID, policy version ID and deletion time.

## Compatibility

- Additive optional payload fields are backward compatible within v1.
- Renaming/removing fields or changing meaning requires a new event type suffix.
- Unknown event versions go to retry/dead-letter handling and do not mutate projections.
