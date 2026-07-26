# Notification and Quick Action Contract

## Registration

1. Request notification permission through the platform adapter.
2. Register the resulting FCM/APNs endpoint through Module 1's
   `POST /v1/notification-endpoints` with platform/provider/token and an idempotency key.
3. Revoke the endpoint on logout or explicit device removal; do not log the device token.

## Badge sources

The badge projection is derived from backend action items, approvals, photo debt, KPI updates and
booking events. Each item is keyed by the server event ID or documented effect key. Refresh,
reconnect and duplicate push delivery must preserve one visible badge/effect. Read and clear
actions only acknowledge or hide the presentation state; they must not close, approve, arrive,
cancel, reschedule or otherwise mutate the backend item without its documented operation.

## Deep-link validation

Every push or action intent carries only a safe source ID/type and optional route. On receipt the
app must check:

- valid authenticated session and current tenant;
- branch and permission scope;
- current resource status and state version;
- intent expiry and supported route;
- whether the action is read-only or a mutation.

Invalid or stale intents open a refresh/error state and never mutate.

The canonical intent projection is `{ eventId|effectKey, tenantId, kind, sourceType, sourceId,
deepLink, receivedAt, readAt?, action?, expiresAt?, origin }`. `action` may only be
`ARRIVED_PROOF` or `CANCEL_OR_RESCHEDULE`; `deepLink` is a supported route plus safe source
identifiers, never a credential or signed URL. The server event/effect identity is the dedupe key.

## Shared resolver and native response boundary

Every action-item route, push notification and native lock-screen response MUST call the single
shared resolver at `apps/mobile/src/navigation/deep-link-resolver.ts`. The notification handler
and platform adapters may normalize provider-specific payloads, but they must delegate tenant,
branch, permission, freshness and mutation checks to that resolver. No second scope-validation
implementation is allowed.

The resolver recognizes `ARRIVED_PROOF` and `CANCEL_OR_RESCHEDULE` as action effect keys and
returns an authenticated in-app flow when the platform cannot expose the native action.

## Quick action: `ARRIVED_PROOF`

The visible action is “Đã đến”. It is an authenticated proof-media flow, not a blind lock-screen
state transition:

1. Resolve the current tenant, branch, booking, permission and booking state.
2. Fetch/confirm the effective customer-photo policy and record customer consent if no valid
   same-scope consent exists.
3. Capture or select the permitted proof image, create a signed upload intent, upload and complete
   the media object.
4. Call the Module 4 arrival operation with the consent ID, media ID when required and the latest
   expected state version.
5. Re-fetch booking/photo debt/action items and reconcile the notification.

Cancellation or media authorization failures leave the booking unchanged and show a safe reason.
Retries reuse the same intent boundary and cannot create duplicate arrival transitions or photo debt.

## Quick action: `CANCEL_OR_RESCHEDULE`

The visible action is “Hủy/Rời lịch”. It opens an authenticated in-app flow. The app fetches current
cancellation reason versions, lets the user choose cancellation or reschedule, validates the current
booking state, then sends the documented idempotent outcome/reschedule command. It never embeds a
default reason in a lock-screen payload and never hides a conflict.

## Platform fallback

If a platform or build profile cannot expose lock-screen action buttons, the notification opens the
validated in-app deep link with the same flows. The app reports capability state for diagnostics,
but no business data or permission decision depends on the platform feature.

## Privacy

Push payloads exclude access/refresh tokens, device tokens, signed URLs, raw customer PII, raw chat
body and raw evidence. Notification previews use safe display text and IDs; detail is fetched after
authentication and authorization.
