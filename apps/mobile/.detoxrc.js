const lightLaunchArgs = { 'ui-test-appearance': 'light' };
const darkLaunchArgs = { 'ui-test-appearance': 'dark' };
const accessibilityLaunchArgs = {
  'ui-test-appearance': 'light',
  'ui-test-accessibility': 'true',
};
const androidPhoneAvdName = process.env.DETOX_ANDROID_PHONE_AVD || 'Pixel_6_API_34';
const androidTabletAvdName = process.env.DETOX_ANDROID_TABLET_AVD || 'Pixel_Tablet_API_34';
const androidBuildCommand =
  process.platform === 'win32'
    ? 'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug'
    : 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug';

/**
 * Release-fidelity build. `releaseE2e` inherits `release`, so the JS bundle is embedded in the APK
 * and no Metro round trip happens at launch — which is the only way SC-001 and SC-003 measure the
 * configuration users actually receive. `adsupTestBuildType` moves `assembleAndroidTest` onto the
 * same variant so the instrumentation APK matches the app under test.
 */
const androidReleaseBuildCommand =
  process.platform === 'win32'
    ? 'cd android && gradlew.bat assembleReleaseE2e assembleReleaseE2eAndroidTest -PadsupTestBuildType=releaseE2e'
    : 'cd android && ./gradlew assembleReleaseE2e assembleReleaseE2eAndroidTest -PadsupTestBuildType=releaseE2e';

module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'jest.detox.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Adsup Mobile.app',
      build:
        'xcodebuild -workspace ios/AdsupMobile.xcworkspace -scheme AdsupMobile -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: androidBuildCommand,
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/releaseE2e/app-releaseE2e.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/releaseE2e/app-releaseE2e-androidTest.apk',
      build: androidReleaseBuildCommand,
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 15' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: androidPhoneAvdName },
    },
    tabletSimulator: {
      type: 'ios.simulator',
      device: { type: 'iPad (10th generation)' },
    },
    tabletEmulator: {
      type: 'android.emulator',
      device: { avdName: androidTabletAvdName },
    },
  },
  configurations: {
    'ios.phone.light': { device: 'simulator', app: 'ios.debug', launchArgs: lightLaunchArgs },
    'ios.phone.dark': { device: 'simulator', app: 'ios.debug', launchArgs: darkLaunchArgs },
    'ios.phone.a11y': {
      device: 'simulator',
      app: 'ios.debug',
      launchArgs: accessibilityLaunchArgs,
    },
    'ios.tablet.light': {
      device: 'tabletSimulator',
      app: 'ios.debug',
      launchArgs: lightLaunchArgs,
    },
    'ios.tablet.dark': {
      device: 'tabletSimulator',
      app: 'ios.debug',
      launchArgs: darkLaunchArgs,
    },
    'android.phone.light': {
      device: 'emulator',
      app: 'android.debug',
      launchArgs: lightLaunchArgs,
    },
    'android.phone.dark': { device: 'emulator', app: 'android.debug', launchArgs: darkLaunchArgs },
    'android.phone.a11y': {
      device: 'emulator',
      app: 'android.debug',
      launchArgs: accessibilityLaunchArgs,
    },
    'android.tablet.light': {
      device: 'tabletEmulator',
      app: 'android.debug',
      launchArgs: lightLaunchArgs,
    },
    'android.tablet.dark': {
      device: 'tabletEmulator',
      app: 'android.debug',
      launchArgs: darkLaunchArgs,
    },
    // Performance criteria must run against the embedded-bundle build; a debug APK pays a Metro
    // fetch on every launch, which is not what a user experiences.
    'android.phone.release': {
      device: 'emulator',
      app: 'android.release',
      launchArgs: lightLaunchArgs,
    },
    'android.tablet.release': {
      device: 'tabletEmulator',
      app: 'android.release',
      launchArgs: lightLaunchArgs,
    },
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug', launchArgs: lightLaunchArgs },
    'android.emu.debug': { device: 'emulator', app: 'android.debug', launchArgs: lightLaunchArgs },
    'ios.tablet.debug': {
      device: 'tabletSimulator',
      app: 'ios.debug',
      launchArgs: lightLaunchArgs,
    },
    'android.tablet.debug': {
      device: 'tabletEmulator',
      app: 'android.debug',
      launchArgs: lightLaunchArgs,
    },
  },
};
