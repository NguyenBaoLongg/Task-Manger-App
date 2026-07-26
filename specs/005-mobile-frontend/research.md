# Research: Mobile Frontend MVP

## Context

The repository contains the Module 1-4 backend, PostgreSQL schema, shared TypeScript
contracts and worker adapters, but no mobile application package. Module 5 therefore adds
an Expo application under `apps/mobile` and consumes the existing HTTP, media, notification
and realtime boundaries. It does not add authoritative mobile-only data or a second business
rules engine.

## Decisions

### React Native and Expo

- **Decision**: Use React Native with TypeScript and Expo. T001 selects and records one exact
  Expo SDK version in `apps/mobile/package.json` and `pnpm-lock.yaml`; implementation artifacts
  must not refer to a floating “current SDK”.
- **Rationale**: This is the constitution baseline and the mobile reference explicitly
  requires native camera, push notification and lock-screen capabilities. Expo development
  builds keep those capabilities testable without making Expo Go a production dependency.
- **Alternatives considered**: Flutter was rejected because the repository and governance
  already standardize the native client baseline on React Native/Expo.

### Navigation and screen boundaries

- **Decision**: Use Expo Router with three accessible bottom-level areas: Dashboard/OKR-KPI,
  Workspace and Chat. Auth, tenant selection, deep links and action flows live outside the
  tab shell as guarded routes.
- **Rationale**: This matches the mobile reference, supports notification deep links and
  keeps booking, attendance and approval screens addressable without duplicating state.
- **Alternatives considered**: A custom navigation registry was rejected because it would
  duplicate deep-link and back-stack behavior.

### Server state and local state

- **Decision**: Use TanStack Query for server state, cursor pagination and invalidation; use
  Zustand for the small session/tenant UI context; use SecureStore for token material only.
  Drafts and transient upload metadata may use a bounded local store, but are explicitly
  non-authoritative and cleared on logout, tenant switch or expiry.
- **Rationale**: Query keys can include tenant and branch scope, while mutation invalidation
  makes server reconciliation explicit after retries and realtime events.
- **Alternatives considered**: A single global Redux-style cache was rejected because it
  makes tenant switching and sensitive cache eviction harder to audit.

### API and contract consumption

- **Decision**: Implement one authenticated API client with typed operation adapters aligned
  to the Module 1-4 OpenAPI documents and shared Zod schemas. Every mutation accepts an
  idempotency key and every response is revalidated before entering the cache.
- **Rationale**: The backend contracts are the authority for tenant scope, RBAC, state
  versions, policy versions, form versions and problem codes. The client must not infer
  business outcomes from cached data.
- **Alternatives considered**: Duplicating business DTOs and rules inside each feature was
  rejected because it would drift from the existing contracts.

### Authentication and tenant context

- **Decision**: Use a provider adapter for Google sign-in, exchange the provider result at
  `/v1/auth/google`, rotate sessions through `/v1/auth/refresh`, and revoke through
  `/v1/auth/logout`. The selected tenant and branch are derived from `/v1/me/tenants` and
  backend membership scope; the client never treats a user-entered tenant ID as authority.
- **Rationale**: This follows the PRD and constitution while allowing local tests to use a
  credential-free auth double.
- **Alternatives considered**: Treating Google profile fields or local storage as membership
  authority was rejected by the PRD and constitution.

### Dynamic forms

- **Decision**: Render only published `FormVersion` JSON Schema supplied by the backend,
  with a documented supported keyword subset and native renderers. Client validation is a
  usability aid; server validation remains authoritative. Unsupported schema features show
  an explicit compatibility error instead of being silently dropped.
- **Rationale**: This preserves versioned form submissions and prevents a mobile renderer
  from changing business meaning.
- **Alternatives considered**: Hard-coded forms and a permissive untyped JSON editor were
  rejected because both violate versioned-form compatibility.

### Media and privacy

- **Decision**: Use native camera/file APIs to collect video or photos, calculate the
  required checksum, obtain a short-lived signed upload intent, upload directly, complete
  the media record, and discard local media when the flow is complete or cancelled. For a
  booking “Đã đến” action, the app collects proof media and follows the existing customer
  consent and booking arrival contracts before sending ARRIVED.
- **Rationale**: Module 1 and Module 4 already define authorized media purposes, consent,
  signed URLs and retention. The mobile app must not expose raw URLs or store authoritative
  media locally.
- **Alternatives considered**: Uploading through the API process or evaluating video quality
  on-device was rejected due to privacy, memory and backend-authority requirements.

### Chat, notifications and quick actions

- **Decision**: Use REST for channel/message pagination and Socket.io for tenant-scoped live
  updates. Register FCM/APNs endpoints through Module 1, deduplicate notification effects by
  event/item identity, and route every notification and native action response through the
  shared validated deep-link resolver. “Đã đến” opens an authenticated proof-media flow;
  “Hủy/Rời lịch” always opens an in-app reason/confirmation flow and refreshes booking state
  before mutation.
- **Rationale**: This satisfies the reference while respecting Module 4’s required consent,
  reason version and optimistic concurrency fields.
- **Alternatives considered**: Mutating a booking directly from a lock-screen payload was
  rejected because the payload may be stale and cannot safely carry the required reason and
  media authorization context.

### Testing and local providers

- **Decision**: Use Jest with `jest-expo` and React Native Testing Library for all mobile unit,
  component, contract and integration tests, and Detox against an Expo development build for
  device E2E smoke. Jest is the only mobile test runner. Camera, Google, FCM/APNs, Socket.io and object
  storage use local adapters/test doubles in credential-free tests.
- **Rationale**: Native capability tests need Expo’s Jest preset and a device-level runner,
  while API and state logic remain fast and deterministic in unit tests.
- **Alternatives considered**: Testing only with mocked screenshots was rejected because it
  would not cover permission, session refresh, upload retry, deep links or accessibility.

## Risks and mitigations

- Native quick-action support differs between iOS and Android: ship a development-build
  capability check and a deep-link fallback.
- Background upload can be interrupted by the OS: persist only a non-sensitive upload
  intent and resumable metadata, reauthorize on resume, and make completion idempotent.
- Dynamic schemas can exceed the renderer subset: expose a server-contract compatibility
  error and keep the form submission unavailable until the schema is supported.
- A tenant switch can leave stale queries: namespace every query and websocket room by tenant
  and branch, cancel old requests, clear sensitive caches and reconnect after scope change.
