# Mobile API Contract Map

This document maps mobile use cases to the stable Module 1-4 contracts. It is a consumer map,
not a new backend API. The source of truth remains the referenced OpenAPI and domain-event files.

## Request envelope

- Send `Authorization: Bearer <accessToken>` for authenticated operations.
- Put the selected `tenantId` in the documented path only after it came from the authenticated
  membership response. Do not accept a tenant ID or branch scope from an unvalidated local
  payload as authority.
- Send `Idempotency-Key` for every create, submit, decision, upload completion, status transition,
  chat send and notification registration mutation where the source contract requires it.
- Include `expectedStateVersion`, `expectedBookingStateVersion` or the documented policy/form
  version exactly as returned by the server; stale state maps to a conflict UI and refresh.
- Parse `application/problem+json` into `{ code, message, correlationId }`; never expose raw
  stack traces or provider details.

## Module 1: identity, tenant, forms, chat, media and notifications

Source: `specs/001-multitenant-foundation/contracts/openapi.yaml`.

| Mobile use | Operations |
|---|---|
| Google login/session | `POST /v1/auth/google`, `POST /v1/auth/refresh`, `POST /v1/auth/logout` |
| Profile and workspace | `GET/PATCH /v1/me`, `GET /v1/me/tenants`, `GET /v1/tenants/{tenantId}`, `GET /v1/tenants/{tenantId}/branches` |
| Dynamic form catalog/submission | `GET /v1/tenants/{tenantId}/form-templates`, `POST .../submissions` |
| Chat history/send | `GET/POST /v1/tenants/{tenantId}/channels`, `GET/POST .../channels/{channelId}/messages` |
| Push registration | `POST /v1/notification-endpoints`, `POST .../{endpointId}/revoke` |
| Generic media | `POST /v1/tenants/{tenantId}/media/upload-intents`, `POST .../media/{mediaId}/complete`, `POST .../media/{mediaId}/download-url` |

The mobile client must honor the permission annotations in the source contract and use the
backend response to decide whether a screen/action is available.

## Module 2: KPI, action center and evidence

Source: `specs/002-okr-kpi-engine/contracts/openapi.yaml`.

- KPI dashboards/reports use the tenant KPI definition, target, report, progress and evaluation
  operations exposed by the contract.
- Employee action center uses `GET /v1/tenants/{tenantId}/action-items`; managers use
  `GET /v1/tenants/{tenantId}/management/action-items` only when the returned permission and
  branch scope allow it.
- Employee action-center filters are `state`, `itemType` and `businessDate`. Manager filters are
  `branchId`, `departmentId`, `membershipId`, `itemType`, `state`, `from` and `to`. `departmentId`
  MUST be published by the owning Module 2 contract before mobile implementation; it is a
  dependency contract field, never a mobile-only query parameter.
- Evidence/photo-debt flows use the KPI evidence endpoints and the generic Module 1 media flow.
- The client displays `openCount`, `deepLink`, target/actual/remaining and server state without
  recalculating KPI values or closing an action item locally.

## Module 3: attendance and approvals

Source: `specs/003-timekeeping-workflows/contracts/openapi.yaml`.

- Read shifts/schedules through `.../attendance/shifts` and `.../attendance/schedules`.
- Load off-calendar and effective video policy through `.../attendance/off-calendar` and
  `.../attendance/video-policies`; acknowledge policy with
  `POST .../attendance/video-policy/acknowledgements` before capture when required.
- Create check-in media through Module 1, then submit `POST .../attendance/check-ins` with
  the server-approved media object ID. Review is manager-only through the review operation.
- Submit leave, late notice, sudden leave and shift requests through
  `POST /v1/tenants/{tenantId}/workflows/requests`; decisions use
  `POST .../workflows/requests/{requestId}/decisions`.
- Read monthly absence summaries and penalty settlements through their scoped operations; payment
  transitions and evidence upload are available only when the returned RBAC allows them.

## Module 4: booking, arrival, forms and photo debt

Source: `specs/004-booking-export/contracts/openapi.yaml`.

- Calendar/customer/configuration reads use the customer, service, cancellation-reason and booking
  list/detail operations with branch filters supplied only within effective scope.
- Scheduled and walk-in creation use their documented versioned form payloads and idempotency key.
- Customer photo flow is ordered: fetch effective consent policy, record consent, create the
  customer-photo upload intent, upload/complete media, then call the arrival or tour operation.
- The quick action “Đã đến” cannot skip the consent/media sequence. It must submit the latest
  `consentId`, `customerPhotoMediaId` where required and `expectedStateVersion`.
- “Hủy/Rời lịch” loads current cancellation reasons, asks the user to choose the applicable
  reason/reschedule path in-app, then uses the outcome/reschedule operation with the latest
  optimistic-concurrency value.
- Photo debt, outcome and tour completion are rendered from server state; no local shortcut can
  mark a tour complete.

## Realtime and notification consumption

Sources: `specs/001-multitenant-foundation/contracts/realtime.md` and Module 2-4 domain events.

- Join only the tenant/branch/channel rooms authorized by the current membership.
- Accept `action-item.changed` and supported chat events, validate event IDs and scope, then
  invalidate or reconcile the relevant query. Reconnect must not duplicate messages or badges.
- Notification payloads may identify safe IDs/codes and deep links but must not carry tokens,
  signed media URLs, raw evidence JSON or unredacted customer/chat data.
- All notification and native quick-action intents MUST delegate scope, freshness and mutation
  checks to the shared mobile deep-link resolver; notification handlers must not implement a
  second validation path.

## Known mobile adapter boundaries

Provider credentials are not required for local acceptance. Google, camera, FCM/APNs, Socket.io
transport and object storage are represented by adapters with deterministic test doubles. Any
contract mismatch discovered during implementation must be reported and fixed in the owning
Module 1-4 contract before the mobile client invents a field or endpoint.
