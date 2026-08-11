# Mobile Verification Record

## Automated local result

- Mobile Jest: passed, 57 suites and 83 tests with `corepack pnpm --filter @adsup/mobile test`.
- Mobile typecheck: passed with `corepack pnpm --filter @adsup/mobile typecheck`.
- Mobile lint: passed with `corepack pnpm --filter @adsup/mobile lint`.
- Mobile format: passed with Prettier 3.9.5 over all mobile source, tests, scripts and root configs;
  generated Android `.cxx`/build artifacts are excluded.
- Workspace Vitest: passed, 54 suites and 154 tests; mobile tests are excluded because Jest is
  the single mobile runner.
- Detox runner configuration: parsed and invoked Jest through `apps/mobile/.detoxrc.js`; its
  Android build command now enters the generated `android/` project on Windows and Unix.
- Detox native E2E: completed on Android as of 2026-08-10 — 7/7 functional suites and 10/10 tests on
  both the phone and tablet release profiles against the real seeded API. iOS remains unexecuted;
  this Windows host has no simulator or Xcode. See the 2026-08-10 entry.
- Expo export: RESOLVED on 2026-08-06, see the update below. Previously blocked because the
  optional `react-native-web` dependency was missing.
- Local Expo Go preview: Metro is reachable at `exp://192.168.88.121:8081` and the API is
  reachable at `http://192.168.88.121:3000`. The local fake Google token matches the backend
  verifier format, and a live `POST /v1/auth/google` check returned an access token.
- Backend API/migration/worker compatibility: combined contract, migration, integration and mobile
  compatibility commands passed on 2026-08-03. Environment-gated suites reported their explicit
  skips; live PostgreSQL/API/worker quickstart validation remains T114.

## Measurements

- SC-001 denominator: 20 seeded runs per supported device profile; pass threshold 19/20 under 60s.
  **PASS.** Measured 2026-08-10 on the `releaseE2e` build: phone 20/20 (median 14,936 ms) and
  tablet 20/20 (median 15,350 ms). Per-run samples and environment are in the 2026-08-10 entry
  below. T118 and T132 are complete.
- SC-003 denominator: 20 runs for each device profile and `COLD_START`, `WARM_CACHE`,
  `DEGRADED_NETWORK`; pass threshold 19/20 under 3s. **FAIL.** Measured 2026-08-10 on the phone
  release build: `WARM_CACHE` 20/20 (median 423 ms), `COLD_START` 0/20 (median 6,867 ms),
  `DEGRADED_NETWORK` 0/20 (median 6,432 ms). **The harness, not the app, misses the budget** — see
  the 2026-08-11 entry: `device.launchApp` adds roughly 5.7 s that a user never pays, which is more
  than the whole 3 s allowance, and `DEGRADED_NETWORK` never actually degrades because `adb reverse`
  bypasses the throttled radio. Three independent methods put the app's own cold start at 1.3-1.9 s.
  T119 and T133 stay open for a corrected harness, not for optimisation.
- SC-009 denominator: every injected failure scenario, minimum 20 across platform/network profiles;
  recovery requires safe retry, re-auth or refreshed server state without duplicate mutation.
  Jest covers 20/20 injected scenarios and currently passes at 100% in the local matrix; T120 is
  complete.

## Implemented local scope

- Booking calendar/detail/create/outcome screens consume tenant-scoped Module 4 APIs.
- Dynamic booking creation uses the published FormVersion renderer and mutation idempotency.
- Customer proof upload is consent-bound, completion-bound and has local media cleanup.
- Penalty ledger displays server state and gates payment-proof submission by permission.
- Detox uses one canonical config file and Jest is the only mobile test runner.
- Sign-in shows connection/token-specific errors and uses the API base URL without an extra `/api`
  segment, matching the backend's `/v1` route mounting.
- Local preview seed binds `local-mobile-user` to the seeded owner membership so the first login
  reaches the demo workspace instead of creating an unscoped account.
- UI polish pass: shared safe-area screen frame, token-driven surfaces/status pills/CTA buttons,
  dense dashboard action center, workspace quick actions, attendance, booking calendar, chat
  notification strip and refined tab bar are implemented and covered by accessibility tests.
- T106 static pass: `.detoxrc.js` parses with canonical iOS/Android phone/tablet light/dark and
  accessibility profiles; the accessibility smoke uses stable `testID` selectors.
- T107 static pass: the critical-path E2E harness now covers sign-in, seeded workspace selection,
  branch selection and Dashboard entry through stable `testID` selectors.
- T037/T064/T080/T095 static pass: the US1/US3/US4/US5 Detox smoke files now exercise stable
  `testID` selectors for auth/workspace, attendance/approval, booking and chat/notification paths.
- T121/T122/T134 static pass: iOS and Android native action identifiers for `ARRIVED_PROOF` and
  `CANCEL_OR_RESCHEDULE` normalize before shared resolver validation; local Jest coverage passes in
  `apps/mobile/tests/integration/native-quick-actions.integration.test.ts`, and the Detox harness no
  longer uses a placeholder.
- T123 static pass: Detox artifacts use `apps/mobile/.detoxrc.js` as the single canonical runner
  config, with `apps/mobile/jest.detox.config.js` only as the Detox-owned Jest runner target.
- T132 static pass: the login/workspace performance E2E no longer uses a placeholder and records a
  JSON result marker with denominator, pass threshold, limit, pass count and per-run samples. Detox
  now points at `apps/mobile/jest.detox.config.js` so E2E files are not excluded by the regular
  mobile Jest config; the Detox Jest config now uses
  `detox/runners/jest/testEnvironment` so the worker instance is installed before E2E tests run.

## Remaining release blockers

Superseded in part by the 2026-08-10 entry. Android native execution is no longer a blocker; items
1, 3, 4 and 5 below are closed and retained only as the record of how the module got here. What is
still open:

1. **SC-003 has no trustworthy measurement** (T119, T133). What the harness reports is dominated by
   Detox's own launch overhead, and its degraded-network profile does not degrade anything. Closing
   these needs an in-app timing marker — `Process.getStartUptimeMillis()` to first actionable
   commit — and a transport that actually crosses the throttled path. The app itself looks to be
   inside the budget at 1.3-1.9 s, but that is not yet asserted by a test.
2. **The iOS half of the canonical Detox matrix is unexecuted** (T135). It requires macOS and Xcode,
   which this host does not have. Native lock-screen delivery for the T134 harness is validated
   there too.
3. **Not every quickstart scenario has been walked end to end on device** (T114). Real video capture
   in particular cannot be exercised on an emulator.

Closed by the 2026-08-10 run:

1. ~~Build and run the native development client on Android, then execute the Detox phone/tablet,
   accessibility and critical-path scenarios.~~ Done on both Android profiles, 7/7 suites.
2. Validate every quickstart scenario with PostgreSQL, API, worker and a development build.
   PostgreSQL is available: the host runs service `postgresql-x64-18` natively, so Docker is not
   required. **Still open as T114** — the backend and device are available, the walkthrough is not
   complete.
3. ~~T107 remains unchecked until a native build executes the seeded Module 1-4 API critical path
   end to end.~~ Executed on phone and tablet.
4. ~~T132 remains unchecked until the SC-001 harness runs on a native build with the local API
   reachable and records at least 19/20 under 60s.~~ Recorded 20/20 on both profiles.
5. ~~The Windows host cannot provide a native result because every tested AVD stays `offline`.~~
   Resolved: AEHD replaced WHPX, `hypervisorlaunchtype` was turned off, and AVDs created by
   `avdmanager` needed `hw.gpu.enabled=yes` written into `config.ini`. Both emulators now boot and
   run Detox.

## Update 2026-07-30

- `corepack pnpm --filter @adsup/mobile test`: PASS, 57 suites / 82 tests.
- `corepack pnpm --filter @adsup/mobile typecheck`: PASS.
- `corepack pnpm --filter @adsup/mobile lint`: PASS with `--max-warnings=0`.
- Targeted Prettier check over touched mobile source/E2E files: PASS.
- `corepack pnpm contracts:validate`: PASS, 1 file / 2 tests.
- `corepack pnpm test:contract`: PASS, 26 files / 109 tests.
- Native Detox/Expo development-build execution remains blocked by the local Android emulator
  crash/offline condition already recorded above; T111/T114/T132/T133/T135 remain open and no
  native runtime/release gate is marked complete without that run.

## Update 2026-08-03

- Android ADB/AVD diagnostic: `D:\Android\Sdk\platform-tools\adb.exe devices -l` returned no
  devices. `Pixel_4_API_34_Clean` also exited before appearing in ADB when launched headless with
  `-gpu swiftshader_indirect -no-snapshot`; T107/T118/T119/T132/T133/T135 remain unchecked.
- Android development build: PASS with `.\gradlew.bat assembleDebug --console=plain --no-daemon`;
  `app-debug.apk` SHA-256 is
  `17A88954F2B9ED69303E0AAB7B4E997704323F852A07CCAA4DCC93F891D696E4`.
- Canonical Detox Android build: PASS with
  `corepack pnpm --filter @adsup/mobile exec detox build --config .detoxrc.js --configuration android.phone.light`;
  Detox invoked `cd android && gradlew.bat assembleDebug`. No device was required for this build
  check, and no Detox test result is claimed.
- Android production build: PASS with `ADSUP_ANDROID_CXX_DIR=D:\cxx\adsup-mobile` and
  `.\gradlew.bat assembleRelease --console=plain --no-daemon`; 1,327 modules bundled and
  `app-release.apk` SHA-256 is
  `E9F043389024D533F9E26917821827A31112DF1D27B25435A282FB37DBBD601D`.
- The native build fixes keep `index.ts` inside the app root, make Gradle's Node invocation disable
  Expo's automatic monorepo server-root promotion, and allow a short external CMake staging tree on
  Windows without disabling React Native New Architecture.
- `corepack pnpm --filter @adsup/mobile test`: PASS, 57 suites / 83 tests. Typecheck, lint and the
  scoped mobile Prettier check also PASS. Jest still emits non-failing React `act(...)` warnings
  from asynchronous `@expo/vector-icons` loading in accessibility tests.
- `corepack pnpm contracts:validate`: PASS, 1 file / 2 tests.
- `corepack pnpm test:contract`: PASS, 26 files / 109 tests.
- `corepack pnpm test:migration`: PASS, 7 files / 20 tests; 1 file / 3 tests skipped by its declared
  environment gate.
- `corepack pnpm test:integration`: PASS, 37 files / 71 tests; 26 files / 64 tests skipped by their
  declared environment gates.
- Mobile Module 1-4 compatibility: PASS, 7 contract suites / 8 tests and 18 integration suites / 29
  tests.
- T112 and T113 are complete from the recorded build/static/compatibility evidence. T117 review is
  complete with unresolved gates recorded here. T111 and T114 remain open because native E2E and
  the live PostgreSQL/API/worker/development-build quickstart have not run.

## Update 2026-08-06

- Traceability (T108/CR-006): `traceability.md` rebuilt. It previously held 10 rows covering 2 of
  26 FR, 0 of 6 CR and 3 of 10 SC, and three rows cited wrong identifiers — `FR-010` was labelled
  video check-in (it is dynamic forms), `FR-020` was labelled booking/ARRIVED (it is the deep-link
  re-check requirement) and `FR-030` does not exist in `spec.md`, which stops at FR-026. All 26 FR,
  6 CR and 10 SC are now mapped to named artifacts, and all 58 file paths cited were verified to
  exist. FR-026 and CR-005 are recorded as REVIEW rather than PASS: FR-026 is negative scope with
  nothing to assert, and CR-005's latency telemetry has no dedicated assertion.
- `react-native-web@0.21.2` and `react-dom@19.1.0` added as mobile dev dependencies. `react-dom`
  is pinned to 19.1.0 to match the Expo-pinned `react@19.1.0`; installing `react-native-web` alone
  pulled `react-dom@19.2.7` and produced an unmet peer warning.
- Expo web export: PASS with `expo export --platform web`. Produced a 1.9 MB bundle plus
  `index.html` and `metadata.json`. This clears the export blocker recorded above; no production
  credential was required. Native iOS/Android export remains covered by T135.
- Regression after the dependency change: `corepack pnpm --filter @adsup/mobile test` PASS,
  57 suites / 83 tests, unchanged from the 2026-08-03 baseline. Typecheck PASS. Lint PASS with
  `--max-warnings=0`.
- No native-device result is claimed by this update. T107, T111, T114, T118, T119, T132, T133 and
  T135 remain open and still require a stable Android or iOS runtime.

## Update 2026-08-07 — Android emulator root cause

The graphics-driver diagnosis recorded earlier in this file was wrong. A controlled run replaced it.

Run: `emulator -avd Pixel_4_API_34_Clean -gpu swiftshader_indirect -no-snapshot -no-audio
-no-boot-anim -no-window`, emulator 36.6.11.0, system image `android-34/google_apis/x86_64`.

Observed:

- All compatibility checks passed, including `hasCompatibleHypervisor` and `hasSufficientHwGpu`.
- WHPX reported `Windows Hypervisor Platform accelerator is operational`.
- The emulator opened its ADB ports; `adb devices` listed `emulator-5554`, and 5554/5555 were
  LISTENING with an established connection.
- The device stayed `offline` for 5.5 minutes and never reached `sys.boot_completed`.
- `qemu-system-x86_64` measured **0% CPU over 10 seconds**, 224 MB working set, 111 threads. The
  emulator had allocated 2560 MB. A booted Android guest holds 1.5-2.5 GB.

That rules out the previous explanation on three counts: the process did not crash, the run used
software rendering with `-no-window` so the GPU was not in the path, and the hang occurs before any
frame could be drawn.

Two further runs were made on the same host. The first conclusion drawn from the single run above
-- "the guest kernel never executes" -- was too strong; the full picture is that the guest executes
and then stalls, and how far it gets depends on the AVD:

| AVD | System image | CPU | Working set | `adb` state | Outcome |
|---|---|---|---|---|---|
| `Pixel_4_API_34_Clean` | android-34 google_apis | 0% | 224 MB | offline | Guest never ran. AVD ships `hw.gpu.enabled=no` |
| `Pixel_4` | android-37.1 google_apis_playstore_ps16k | 206% | 3806 MB | offline | Ran hard for 13 minutes, never completed boot |
| `Detox_A34` (created clean) | android-34 google_apis | 0% after progress | 1049 MB | **device** | Reached adbd handshake with `product:sdk_gphone64_x86_64`, then stalled; `adb shell` and `logcat` returned empty |

`avdmanager create avd` writes `hw.gpu.enabled=no` by default, which is why the first AVD never
started. `Detox_A34` was created with `hw.gpu.enabled=yes`, `hw.gpu.mode=swiftshader_indirect`,
3072 MB RAM and 4 cores, and is retained for the retry.

Host state: `VirtualizationBasedSecurityStatus = 2` (VBS running), `SecurityServicesRunning = 0`,
HVCI disabled, `hypervisorlaunchtype` unset (Auto), `HvHost` running. WHPX initializes and the guest
begins executing, but execution halts mid-boot. The host CPU is an Intel Core i9-13900H, a hybrid
P-core/E-core part (14 cores / 20 threads, 15.7 GB RAM, 5 GB free), which is a known-problematic
combination for WHPX-backed Android emulation. Hardware capacity is not the constraint.

Nothing on this host depends on Hyper-V: Docker is not installed, no WSL distribution is present,
and no Hyper-V VM exists. Disabling the Windows hypervisor therefore costs nothing here.

Remediation options, all requiring administrator rights and a reboot:

1. `bcdedit /set hypervisorlaunchtype off`, then reboot, so the emulator uses its own hypervisor.
2. Disable Core Isolation / VBS in Windows Security, then reboot.
3. Install AEHD (Android Emulator Hypervisor Driver) in place of WHPX.

Applied on 2026-08-07: AEHD is installed from SDK Manager (service `aehd` present, `Stopped`,
start type System, driver at `Sdk/extras/google/Android_Emulator_hypervisor_driver`) and
`bcdedit /set hypervisorlaunchtype off` returned success. The host has not yet rebooted, so VBS
still reports status 2 and `HypervisorPresent` is still true. The retry against `Detox_A34` is
pending that reboot.

A cloud device farm was considered and rejected for this feature. SC-001 and SC-003 are latency
measurements with 60s and 3s thresholds over 20 runs per profile; shared cloud hardware makes those
numbers unreliable, and SC-010 requires the real Module 1-4 API, which runs locally and would have
to be tunnelled, adding network latency to the very measurement under test.

## Update 2026-08-10 — native Android execution on the release build

The emulator blocker recorded above is resolved. Detox now runs on two Android device profiles
against the real local API, and the measurements below are device results, not static checks.

### Environment

- Host: Windows 11, Intel Core i9-13900H. AEHD replaces WHPX; `hypervisorlaunchtype` off.
- Emulators: `Detox_A34` (phone, 1080x2340) and `Detox_Tablet_A34` (tablet, 1280x800, density 160),
  both `system-images;android-34;google_apis;x86_64`. One emulator runs at a time so neither
  measurement is skewed by host CPU contention.
- Backend: local PostgreSQL 18 (`postgresql-x64-18`), API and worker running, deterministic seed
  applied. No provider secret was used.
- App under test: `app-releaseE2e.apk`, SHA-256
  `73c97db23de11d368abd7c34892bac6bb520b47e40b1bd56db5629f2309d30c6`, 92,358,090 bytes; the paired
  instrumentation APK `app-releaseE2e-androidTest.apk` is SHA-256
  `f890c9c33d0014888015bf2e4f6e323d39e961aac58b4a4ba3b899ff886f8d3b`. Both device profiles were
  measured on this identical binary.

### Why the release build, not debug

The debug APK contains **0** `index.android.bundle` entries and fetches its JS from Metro on every
launch; the `releaseE2e` APK embeds one of 2,294,200 bytes. Measuring SC-001 or SC-003 on debug
measures the developer's dev server. The gap is visible in the numbers: SC-001 on debug had a median
of 19,228 ms against 14,936 ms on release for the same flow.

`releaseE2e` inherits `release` — same embedded bundle, same signing — and adds only a network
security config permitting cleartext to `10.0.2.2`, `localhost` and `127.0.0.1`. The shipping
`release` variant is untouched, so no test affordance is published.

### SC-001 — login and workspace selection under 60 s

Denominator 20 runs per device profile, threshold 19/20, limit 60,000 ms. Each run reinstalls the
app (`delete: true`) so every sample starts from the initial sign-in state, and the timed window
covers sign-in, workspace selection, branch selection and Dashboard entry with no manual
tenant/branch re-entry.

| Device profile | Build | Numerator | Min | Median | Max |
|---|---|---|---|---|---|
| Phone (`android.phone.release`) | releaseE2e | **20/20** | 13,969 ms | 14,936 ms | 17,116 ms |
| Tablet (`android.tablet.release`) | releaseE2e | **20/20** | 14,417 ms | 15,350 ms | 18,475 ms |
| Phone (`android.phone.light`) | debug | 20/20 | 17,815 ms | 19,228 ms | 22,746 ms |

Tablet per-run samples, in run order (ms): 16686, 14514, 14902, 15352, 14732, 15347, 15427, 15013,
15430, 17327, 18475, 16331, 15903, 15676, 15336, 16029, 15050, 14417, 14851, 14482. Suite wall clock
318.7 s. The debug row is retained only as the contrast that justifies the release build; the
criterion is judged on the two release rows.

**SC-001 PASS on every supported device profile.** T118 and T132 are complete.

### SC-003 — first actionable Dashboard data under 3 s

Denominator 20 runs for each of `COLD_START`, `WARM_CACHE` and `DEGRADED_NETWORK`, threshold 19/20,
limit 3,000 ms. The three profiles are real conditions, not app-side simulation:

- `COLD_START` — process killed and relaunched (`newInstance: true`, `delete: false`), so the stored
  session and workspace selection survive and the app restores the workspace before loading data.
- `WARM_CACHE` — the process is already running and the Dashboard has rendered at least once;
  the timed window is a tab away and back.
- `DEGRADED_NETWORK` — the emulator's virtual radio is shaped with `adb emu network speed edge` and
  `delay edge` (~58 KB/s, 80-400 ms latency), a transport constraint rather than a test-only branch.

Phone (`android.phone.release`):

| Data profile | Numerator | Median |
|---|---|---|
| `COLD_START` | **0/20** | 6,867 ms |
| `WARM_CACHE` | **20/20** | 423 ms |
| `DEGRADED_NETWORK` | **0/20** | 6,432 ms |

Tablet (`android.tablet.release`): **partial.** One run completed the full 60-sample sweep in
287.9 s of measured time and failed its first per-profile assertion with `Expected: >= 19,
Received: 0` — that assertion is `COLD_START`, so the tablet reproduces the phone's cold-start
miss. The per-sample JSON from that run was lost to output truncation, and the retry that would
have recovered it never produced data: Detox lost contact with the app after 92 minutes
(`The app has not responded to the network requests below`) and the emulator process died. Two
further boot attempts came up with a dead network stack. The tablet numerator for `WARM_CACHE` and
`DEGRADED_NETWORK` is therefore **not recorded**.

That gap does not change the verdict. SC-003 requires ≥19/20 on every device and data profile; the
phone already records 0/20 on two of three, so the criterion fails on recorded evidence alone, and
the one tablet observation corroborates rather than contradicts it. Completing the tablet sweep was
judged not worth the cost — see the host-capacity note below.

**SC-003 as measured FAILS, but the harness — not the app — is what misses the budget.** The
paragraph previously here concluded the opposite, that the overhead was too small to explain the
gap. That conclusion was wrong and the 2026-08-11 entry below records the measurements that replace
it. T119 and T133 stay open, but the work they need is a corrected measurement, not app-side
optimization.

### Host capacity limits long device runs

The SC-003 sweep repeatedly froze the development host, and the cause is configuration, not the
test. Both AVDs carry `hw.gpu.mode=swiftshader_indirect`, so the Android guest is rasterized
entirely on the CPU even though the host has an Intel Iris Xe GPU. SC-003 performs 40 cold app
launches plus 20 tab cycles, each redrawing the full UI tree; on the 1280x800 tablet that is
1,024,000 pixels per frame sustained for roughly 90 minutes across 4 vCPUs. Memory is the secondary
constraint: 15.7 GB total with a ~8.7 GB idle baseline leaves ~7 GB, and the emulator (3 GB plus
overhead), API, worker and the Jest/Detox processes consume most of it.

Before the next long device run, in order of effect:

1. Set `hw.gpu.mode=host` in each AVD's `config.ini` so rendering uses the Iris Xe GPU. This is the
   single largest change and would invalidate direct comparison with the SC-001 numbers above, which
   were measured under software rendering — re-measure SC-001 if it is changed.
2. Reduce `hw.ramSize` from 3072 to 2048.
3. Close editor and browser windows for the duration; they account for well over 1 GB here.

The emulator also failed to boot with a working network stack on two of the last three attempts
(`ip -o addr show` lists no `eth0`, `ping 10.0.2.2` reports "Network is unreachable"). Letting Detox
boot the AVD itself has been more reliable than launching it beforehand.

### Functional Detox matrix on device

All seven functional suites, run against the release build with the real seeded local API:

| Device profile | Suites | Tests | Wall clock |
|---|---|---|---|
| Phone (`android.phone.release`) | 7/7 PASS | 10/10 PASS | — |
| Tablet (`android.tablet.release`) | 7/7 PASS | 10/10 PASS | 335.1 s |

Tablet per-suite: `mvp-critical-path` 61.6 s, `native-quick-actions` 110.3 s (4 tests),
`chat-notifications` 29.1 s, `booking` 30.8 s, `auth-workspace` 31.5 s, `accessibility-smoke`
18.2 s, `attendance-approval` 48.0 s.

This covers the phone and tablet legs of the canonical Detox matrix. The iOS simulator profiles
(`ios.phone.light`, `ios.phone.dark`, `ios.phone.a11y`, `ios.tablet.light`, `ios.tablet.dark`)
remain unexecuted: they require macOS and Xcode, which this host does not have. Light/dark and
accessibility launch arguments are exercised on Android through `accessibility-smoke`, but the
iOS-specific rows of the matrix are recorded as not run rather than assumed equivalent.

Pass `-w 1` when naming several suites on one command line. Jest otherwise starts a worker per
suite, each worker asks Detox for its own device, and Detox tries to boot additional instances of
the same AVD — six of seven suites failed with `Process exited with code 1` before the worker count
was pinned. That was a runner-configuration failure, not an app failure.

### Two harness defects found and fixed

Both produced failures that pointed at the wrong component, so they are recorded rather than
silently repaired.

1. **`adb reverse` was required but undocumented.** `EXPO_PUBLIC_*` values are inlined into the JS
   bundle at build time, and the release APK embeds `extra.apiBaseUrl = http://localhost:3000`, so
   setting `EXPO_PUBLIC_API_BASE_URL` at Detox invocation has no effect on it. On Android
   `localhost` is the device, so without a port forward the app renders sign-in, the first tap
   succeeds, and Detox fails on `workspace.option` with a 15 s visibility timeout — which reads as a
   tablet layout defect. It was neither: a view-hierarchy dump confirmed `auth.sign-in` rendered
   correctly at `[384,656][896,712]` on the 1280x800 layout, and the screen carried the app's own
   "Không thể kết nối API" message. `apps/mobile/tests/e2e/setup.ts` now forwards the API port to
   the allocated device before any E2E test and fails loudly if it cannot, so the misleading failure
   mode cannot recur. The tablet functional matrix above was run with `adb reverse --remove-all`
   applied first, which is what verifies the fix.
2. **Emulators occasionally boot with a dead network stack.** `ip -o addr show` lists no `eth0` and
   `ping 10.0.2.2` reports "Network is unreachable". Restarting the emulator clears it. Both
   emulators hit this once. Check the network before attributing a Detox failure to the app.

### Task status from this run

- T107 complete: `mvp-critical-path.e2e.ts` executed end to end against the seeded Module 1-4 API on
  both Android device profiles.
- T111 complete for the Android legs: mobile unit, contract, integration, accessibility and E2E
  suites all recorded here and above. iOS E2E is recorded as not run.
- T118 and T132 complete: SC-001 measured 20/20 on both device profiles, denominator, per-run
  samples and aggregate recorded above.
- T119 and T133 remain open: SC-003 fails `COLD_START` and `DEGRADED_NETWORK` on the phone, and the
  tablet sweep is only partially recorded. Both facts point the same way, so the criterion is
  recorded as FAIL rather than blocked.
- T114 and T135 remain open. Not every quickstart scenario has been walked end to end on device, and
  the iOS half of the canonical matrix cannot be executed on this host.

## Update 2026-08-11 — SC-003 measures Detox, not the app

Two claims recorded earlier in this file are corrected here. Both were stated with more confidence
than the evidence supported.

### Correction 1: the cold-start miss is harness overhead

The earlier entry argued the Detox launch handshake could not account for the gap, because closing
it would need roughly 3,900 ms of overhead. It needs more than that, and there is more than that.

Measured on the phone release build, same APK, same emulator, same seeded API:

| Method | What it measures | Result |
|---|---|---|
| Detox `dashboard-performance.e2e.ts` | clock started before `device.launchApp`, stopped when `dashboard.screen` is visible | median **7,584 ms** |
| `am start -W` | process start to first frame, reported by Android | **677-773 ms** |
| logcat timeline from `am start` | `Running "main"` +750 ms, first API socket +1,220 ms, second +1,460 ms, frames drawn +1,870 ms | **~1,870 ms** to a rendered dashboard |
| poll `uiautomator dump` for `dashboard.screen`, no Detox | same visibility criterion the Detox test uses | 4,050 ms raw, minus 2,480 ms dump cost and ~260 ms of `adb shell` round trips ≈ **~1,310 ms** |

Three independent methods put the app's cold start to a visible dashboard between roughly 1.3 s and
1.9 s. Detox reports 7.6 s for the identical journey. The ~5.7 s difference is `device.launchApp`
orchestration — `am instrument` startup, waiting for the instrumentation process to connect back
over the websocket, and idle-resource synchronisation. A user pays none of it.

That overhead is larger than SC-003's entire 3,000 ms budget, so the harness as written cannot pass
no matter how fast the app becomes. `WARM_CACHE` passes precisely because it is the one profile that
does not relaunch the process and therefore never pays the handshake.

**The app appears to meet SC-003.** This is not claimed as a pass, because the three methods above
each measure something slightly different from "first actionable data" and none of them is the
criterion's own definition. T119 and T133 stay open for a corrected harness, not for optimisation.

The fix is to time from inside the app: record `Process.getStartUptimeMillis()` at launch and emit a
timestamp when the dashboard's first actionable data commits, then assert on the difference. That
excludes the harness by construction and is the same technique Firebase Performance uses for its
`_app_start` trace.

### Correction 2: `DEGRADED_NETWORK` does not degrade anything

`DEGRADED_NETWORK` median 7,657 ms against `COLD_START` 7,584 ms — 73 ms apart, on 20 samples each
with a spread under 620 ms. Throttling the radio to `edge` (~58 KB/s, 80-400 ms latency) changed
nothing measurable, which is only possible if the traffic never crossed the throttled path.

It does not. The release APK embeds `apiBaseUrl = http://localhost:3000` and reaches the API through
`adb reverse`, an adb tunnel from `adbd` straight to the host. `adb emu network speed|delay` shapes
the emulator's simulated cellular NAT, which that tunnel bypasses entirely. As written the profile
is a duplicate of `COLD_START`.

To make it real the app must reach the API over the emulator's virtual radio — rebuild with
`apiBaseUrl = http://10.0.2.2:3000`, which the `releaseE2e` network security config already permits,
and drop the `adb reverse` for that profile only.

### Host-GPU dataset

Prompted by the host freezing during long runs, both AVDs were switched from
`hw.gpu.mode=swiftshader_indirect` to `host`. The hypothesis was that software rasterisation
inflated the cold-start numbers. It did not — the numbers got slightly worse.

| Criterion / profile | swiftshader | host GPU |
|---|---|---|
| SC-001 phone | 20/20, median 14,936 ms | 20/20, median 18,366 ms |
| SC-003 `COLD_START` | 0/20, median 6,867 ms | 0/20, median 7,584 ms |
| SC-003 `WARM_CACHE` | 20/20, median 423 ms | 20/20, median 470 ms |
| SC-003 `DEGRADED_NETWORK` | 0/20, median 6,432 ms | 0/20, median 7,657 ms |

The SC-001 row is confounded: that run also had the emulator process at `BelowNormal` priority,
which yields CPU to the Normal-priority Jest and Detox processes. The SC-003 rows were taken at
Normal priority, so GPU mode is the only variable there — and it costs roughly 700 ms.

Software rendering is therefore the faster configuration on this host. `hw.gpu.mode` was left at
`host`; revert it to `swiftshader_indirect` before re-measuring against the recorded baselines.

### What actually stopped the host freezing

Not the GPU change. `ADSUP_SC003_PROFILES` now runs one data profile per invocation, so the sweep is
three runs of roughly 190-220 s instead of a single unbroken block that took 5,522 s and ended with
Detox losing contact with the app. Sustained load, not peak load, was the problem.

### Three infrastructure failures worth remembering

Each of these presented as a test or app failure and was neither.

1. **`-no-snapshot` breaks the emulator's network stack.** An AVD cold-booted with that flag comes up
   with no `eth0` and `ping 10.0.2.2` reporting "Network is unreachable". Three consecutive boots
   reproduced it; dropping the flag fixed it immediately. This is the explanation for the earlier
   "restarting the emulator fixes it" note, which had no root cause attached.
2. **A killed Detox run corrupts its device registry.** `%LOCALAPPDATA%\data\Detox\device.registry.json`
   was left holding two bytes of whitespace, after which every run died in 1.6 s with
   `SyntaxError: Unexpected token ' ', "  " is not valid JSON` from `ExclusiveLockfile`. Delete that
   file and `global-context.json` alongside it.
3. **`Start-Process -WindowStyle Hidden` drops environment changes.** It routes through
   ShellExecute, which does not carry the calling session's modified environment block, so the API
   and worker started without `DATABASE_URL` and `JWT_ACCESS_SECRET` despite those being set. Writing
   the `set` statements into a `.cmd` launcher works; so does `-NoNewWindow`.
