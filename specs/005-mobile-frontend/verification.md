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
- Expo export: blocked locally. Online export cannot reach Expo's native-module version service;
  offline export also reports the optional `react-native-web` dependency missing. No production
  credential is required for this blocker.
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
  but local Android AVDs (`Pixel_6_API_34`, `Pixel_4` and `Small_Phone`) repeatedly crashed,
  terminated or became `offline`; the crash stack references `libGLESv2.dll`, `libvulkan_lvp.dll`
  and `libgfxstream_backend.dll`, indicating a host Android Emulator/graphics-driver blocker rather
  than app code. Result denominator: 20; numerator: blocked/not recorded; T132 remains unchecked
  until a stable native Android/iOS development build executes at least 19/20 runs successfully.
- SC-003 denominator: 20 runs for each device profile and `COLD_START`, `WARM_CACHE`,
  `DEGRADED_NETWORK`; pass threshold 19/20 under 3s. The Detox harness exists, but no native
  device numerator is recorded yet. T133 remains unchecked on this Windows host because the tested
  Android AVDs cannot stay online long enough to execute the Dashboard/action-center performance
  sample; the blocker is the same Android Emulator graphics/runtime failure recorded for T132.
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
2. Validate every quickstart scenario with PostgreSQL, API, worker and Expo development build. This
   host currently has no `docker` command on `PATH` and no Android runtime online.
3. T107 remains unchecked until a native Android/iOS development build executes the seeded Module
   1-4 API critical path end to end; this Windows run intentionally did not launch Detox.
4. T132 remains unchecked until `apps/mobile/tests/e2e/auth-workspace-performance.e2e.ts` runs on a
   native Android/iOS development build with the local API reachable and records at least 19
   successful runs out of 20 under 60s.
5. The current Windows host cannot provide that native result yet because every tested Android AVD
   terminates or stays offline due to emulator graphics/runtime failures; use a stable Android
   device, a different host, or fix the emulator/driver environment before retrying Detox.
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
