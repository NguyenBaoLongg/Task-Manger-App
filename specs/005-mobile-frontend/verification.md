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
- Detox native E2E: not completed. The generated Android project and both debug/release APKs now
  build successfully, but no Android target remains online and this Windows host has no iOS
  simulator/Xcode development environment.
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
  T132 now uses a real Detox harness in `apps/mobile/tests/e2e/auth-workspace-performance.e2e.ts`
  instead of the previous placeholder. Static typecheck and lint passed on 2026-07-29, but the
  native numerator is not recorded. A later Windows run reached `adb device` and API health `200`,
  but local Android AVDs could not be driven to a booted state. The graphics-driver explanation
  previously recorded here was wrong; see the 2026-08-07 root-cause entry below. Result
  denominator: 20; numerator: blocked/not recorded; T132 remains unchecked until a stable native
  Android/iOS development build executes at least 19/20 runs successfully.
- SC-003 denominator: 20 runs for each device profile and `COLD_START`, `WARM_CACHE`,
  `DEGRADED_NETWORK`; pass threshold 19/20 under 3s. The Detox harness exists, but no native
  device numerator is recorded yet. T133 remains unchecked on this Windows host because the tested
  Android AVDs never reach a booted state; the blocker is the same host virtualization failure
  recorded for T132 and root-caused in the 2026-08-07 entry below.
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

1. Build and run the native development client on Android (Windows) or iOS (macOS), then execute
   the Detox phone/tablet, accessibility and critical-path scenarios.
2. Validate every quickstart scenario with PostgreSQL, API, worker and Expo development build.
   PostgreSQL is available: the host runs service `postgresql-x64-18` natively, so Docker is not
   required for this task. The remaining gap is the Android runtime.
3. T107 remains unchecked until a native Android/iOS development build executes the seeded Module
   1-4 API critical path end to end; this Windows run intentionally did not launch Detox.
4. T132 remains unchecked until `apps/mobile/tests/e2e/auth-workspace-performance.e2e.ts` runs on a
   native Android/iOS development build with the local API reachable and records at least 19
   successful runs out of 20 under 60s.
5. The current Windows host cannot provide that native result yet because every tested Android AVD
   stays `offline` and never boots; the guest never executes, root-caused to host virtualization
   (VBS/WHPX) in the 2026-08-07 entry, not to graphics. Use a physical Android device, a different
   host, or apply one of the administrator-level host fixes before retrying Detox.
6. T133 and T135 remain unchecked for native verification. T133 cannot record SC-003
   Dashboard/action-center numerator data without a stable native runtime. T135 cannot close the
   final Expo development/production native verification gate until Detox/native-device execution is
   available; native lock-screen delivery for the T134 harness is validated there. Backend changes
   are intentionally out of scope for this blocker.

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
