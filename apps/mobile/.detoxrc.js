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
