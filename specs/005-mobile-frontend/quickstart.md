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

Detox uses only `apps/mobile/.detoxrc.js`, which is discovered automatically. Do not pass
`--config .detoxrc.js`; Detox forwards that flag to Jest, which then rejects `testRunner`. Run a
configured profile explicitly, for example
`corepack pnpm --filter @adsup/mobile exec detox test --configuration android.phone.light`.
The canonical matrix also provides `ios.phone.dark`, `ios.tablet.light`, `ios.tablet.dark`,
`android.phone.dark`, `android.tablet.light` and `android.tablet.dark`, plus phone accessibility
profiles for both platforms.
Native builds require Android Studio or Xcode. Windows can build Android debug/release APKs and run
Android Detox when an AVD or physical device is online, but cannot execute the iOS simulator
profile.

## Performance profiles: the release-fidelity build

SC-001 and SC-003 must not be measured on the debug APK. A debug build ships no embedded JS bundle
and fetches it from Metro on every launch, so the number measured is the developer's dev server, not
the app a user receives. Confirm the difference before trusting any measurement:

```powershell
# 1 entry on the release APK, 0 on debug
& "$env:JAVA_HOME\bin\jar.exe" tf apps/mobile/android/app/build/outputs/apk/releaseE2e/app-releaseE2e.apk |
  Select-String 'index.android.bundle'
```

The `releaseE2e` build type exists for this. It inherits `release` — same embedded bundle, same
signing — and adds only a network security config that permits cleartext to `10.0.2.2`, `localhost`
and `127.0.0.1`. The shipping `release` variant is untouched, so no test affordance is published.
`-PadsupTestBuildType=releaseE2e` moves `assembleAndroidTest` onto the same variant so the
instrumentation APK matches the app under test:

```powershell
Push-Location apps/mobile/android
.\gradlew.bat assembleReleaseE2e assembleReleaseE2eAndroidTest -PadsupTestBuildType=releaseE2e
Pop-Location
```

Detox then runs the release configurations, whose AVD names come from `DETOX_ANDROID_PHONE_AVD` and
`DETOX_ANDROID_TABLET_AVD`:

```powershell
$env:DETOX_ANDROID_PHONE_AVD = 'Detox_A34'
corepack pnpm --filter @adsup/mobile exec detox test --configuration android.phone.release `
  tests/e2e/auth-workspace-performance.e2e.ts

$env:DETOX_ANDROID_TABLET_AVD = 'Detox_Tablet_A34'
corepack pnpm --filter @adsup/mobile exec detox test --configuration android.tablet.release `
  tests/e2e/auth-workspace-performance.e2e.ts
```

### `adb reverse` is mandatory for the release build

`EXPO_PUBLIC_*` values are inlined into the JS bundle at **build** time. The committed release APK
embeds `extra.apiBaseUrl = http://localhost:3000`, so setting `EXPO_PUBLIC_API_BASE_URL` when
invoking Detox changes nothing. On Android `localhost` means the device itself, so every emulator
that runs the release build needs the port forwarded first:

```powershell
adb -s emulator-5554 reverse tcp:3000 tcp:3000
```

Without it the app reaches the sign-in screen and then shows
"Không thể kết nối API", and Detox fails on the next matcher — `workspace.option` — with a
visibility timeout rather than a connection error. Each emulator needs its own `reverse`; it does
not carry across devices, and a device restart clears it. Verify with `adb reverse --list`.

### Emulator preparation

`avdmanager create avd` writes `hw.gpu.enabled=no`, and an AVD created that way never boots. Set
`hw.gpu.enabled=yes` and `hw.gpu.mode=swiftshader_indirect` in the AVD's `config.ini` before first
use. An emulator also occasionally boots with a dead network stack: `ip -o addr show` lists no
`eth0` and `ping 10.0.2.2` reports "Network is unreachable". Restarting the emulator fixes it. Check
both before attributing a Detox failure to the app.

Run one emulator at a time when measuring. Two concurrent AVDs contend for host CPU and skew the
latency being measured.

### Run SC-003 one profile at a time

The full sweep is 60 samples and roughly 90 minutes of unbroken emulator load. At that length Detox
has been observed to lose contact with the app (`The app has not responded to the network requests
below`) and the host becomes unusable. `ADSUP_SC003_PROFILES` splits it into runs of about 200 s:

```powershell
$env:ADSUP_SC003_PROFILES = 'COLD_START'
corepack pnpm --filter @adsup/mobile exec detox test --configuration android.phone.release -w 1 `
  tests/e2e/dashboard-performance.e2e.ts
```

Accepts a comma-separated list; unset, the full sweep runs. Sustained load is the problem, not peak
load — chunking fixes the freezing, and lowering emulator CPU or RAM does not (it only slows the
guest, which distorts the very number being measured).

Pass `-w 1` whenever you name more than one suite. Jest otherwise starts a worker per suite and each
asks Detox for its own device, so Detox tries to boot additional copies of the same AVD and most
suites die with `Process exited with code 1`.

### Do not boot the emulator with `-no-snapshot`

An AVD cold-booted with that flag comes up with no `eth0`, and `ping 10.0.2.2` reports "Network is
unreachable". Drop the flag. Letting Detox boot the AVD itself is the most reliable option.

### When every Detox run dies in under two seconds

A run killed mid-flight leaves `%LOCALAPPDATA%\data\Detox\device.registry.json` holding whitespace,
after which every later run fails immediately with
`SyntaxError: Unexpected token ' ', "  " is not valid JSON` from `ExclusiveLockfile`. Delete that
file and `global-context.json` next to it.

### `DEGRADED_NETWORK` is not currently a real transport constraint

SC-003's degraded profile shapes the emulator's virtual radio rather than simulating slowness inside
the app, so no test-only branch is shipped. **But the release build reaches the API through
`adb reverse`, an adb tunnel that bypasses that radio entirely**, so today the profile changes
nothing — measured 7,657 ms against 7,584 ms for an unthrottled cold start. To make it bite, rebuild
with `apiBaseUrl = http://10.0.2.2:3000` (already permitted by the `releaseE2e` network security
config) and skip the port forward for that profile.

```powershell
adb -s emulator-5554 emu network speed edge
adb -s emulator-5554 emu network delay edge
adb -s emulator-5554 emu network speed full   # restore
adb -s emulator-5554 emu network delay none
```

The final module gate also runs the repository API contract tests, backend integration tests,
mobile accessibility checks and an end-to-end smoke against the seeded local API. A test may use a
provider double, but the critical path must exercise the real API contracts and real PostgreSQL
state transitions.
