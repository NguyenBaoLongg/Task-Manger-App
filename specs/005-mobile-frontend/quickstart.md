# Quickstart: Mobile Frontend MVP

This guide validates the Expo client against the real Module 1-4 API. It assumes no production
Google, FCM, APNs or S3 credentials are available; local adapters/test doubles are used for those
providers while PostgreSQL and the API remain real.

## Prerequisites

- Node.js version required by the repository (`>=24`) and Corepack/pnpm.
- PostgreSQL running with the repository's local `DATABASE_URL`.
- Backend migrations and deterministic seed applied.
- API and worker running locally.
- Android emulator, iOS simulator, or a physical device with an Expo development build. Expo Go
  is not sufficient for all camera, notification and lock-screen action checks.

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

Use the repository's existing local auth/provider test configuration for credential-free acceptance.
Do not commit provider secrets.

## Start mobile

After the implementation scaffold exists:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api"
corepack pnpm --filter @adsup/mobile start
```

For a physical device, use a reachable LAN API URL instead of `localhost`. The development build
must include camera, secure storage, notification and deep-link configuration.

## Validation scenarios

1. **Auth and tenant scope**: sign in with the local auth adapter, complete profile confirmation,
   choose one of two seeded tenants, switch branch, and verify requests/data change scope. Attempt
   a foreign tenant/branch deep link and expect a safe forbidden/not-found state.
2. **Dashboard and action center**: load KPI/action items, paginate, open a deep link, receive an
   `action-item.changed` update and verify `openCount` does not duplicate after refresh/reconnect.
3. **Attendance**: acknowledge the effective video policy, record a video, interrupt upload,
   retry it, and verify one server check-in/media effect. Submit a full-day, half-day or date-range
   leave request and decide it with an authorized manager account.
4. **Penalty privacy**: view only the current member's permitted settlement/payment data, attempt
   a forbidden branch, and verify the safe problem response contains a correlation ID but no secret.
5. **Booking forms and arrival proof**: load a published FormVersion, submit a scheduled booking,
   exercise a 60-minute conflict, record customer consent, upload proof media and use “Đã đến”.
   Verify ARRIVED/photo-debt state comes from the backend and retry is idempotent.
6. **Cancel/reschedule quick action**: trigger a booking notification, open “Hủy/Rời lịch”,
   choose a current reason or reschedule, force a stale state version and verify the app refreshes
   instead of applying a conflicting mutation.
7. **Chat and notifications**: paginate a tenant channel, send a message, reconnect the socket,
   verify server ordering and no duplicate optimistic message, then register/revoke a test push
   endpoint.
8. **Accessibility and resilience**: test small/large phone and tablet layouts, light/dark mode,
   Vietnamese dynamic text, screen reader labels/roles/focus order, reduced motion, denied camera,
   offline retry, session expiry and unsupported quick-action fallback.

## Test commands

Expected mobile scripts after implementation:

```powershell
corepack pnpm --filter @adsup/mobile test
corepack pnpm --filter @adsup/mobile test:contract
corepack pnpm --filter @adsup/mobile test:integration
corepack pnpm --filter @adsup/mobile test:e2e
corepack pnpm --filter @adsup/mobile typecheck
corepack pnpm --filter @adsup/mobile lint
corepack pnpm --filter @adsup/mobile build
```

On Windows, verify the generated Android development and production APKs directly. A short CMake
staging path is required when the checkout path would otherwise exceed Ninja's legacy `MAX_PATH`
limit:

```powershell
$env:ADSUP_ANDROID_CXX_DIR = 'D:\cxx\adsup-mobile'
Push-Location apps/mobile/android
.\gradlew.bat assembleDebug --no-daemon
.\gradlew.bat assembleRelease --no-daemon
Pop-Location
```

The committed Gradle Node wrapper supplies Expo's monorepo-root and bundle environment flags. The
verified APKs are written under `apps/mobile/android/app/build/outputs/apk/debug/` and
`apps/mobile/android/app/build/outputs/apk/release/`.

Detox uses only `apps/mobile/.detoxrc.js`. Run a configured profile explicitly, for example
`corepack pnpm --filter @adsup/mobile exec detox test --config .detoxrc.js --configuration android.phone.light`.
The canonical matrix also provides `ios.phone.dark`, `ios.tablet.light`, `ios.tablet.dark`,
`android.phone.dark`, `android.tablet.light` and `android.tablet.dark`, plus phone accessibility
profiles for both platforms.
Native builds require Android Studio or Xcode. Windows can build Android debug/release APKs and run
Android Detox when an AVD or physical device is online, but cannot execute the iOS simulator
profile.

The final module gate also runs the repository API contract tests, backend integration tests,
mobile accessibility checks and an end-to-end smoke against the seeded local API. A test may use a
provider double, but the critical path must exercise the real API contracts and real PostgreSQL
state transitions.
