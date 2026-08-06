import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Adsup Mobile',
  slug: 'adsup-mobile',
  version: '0.1.0',
  orientation: 'default',
  scheme: 'adsup',
  icon: './assets/brand/adsup-logo.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  plugins: [
    'expo-router',
    [
      'expo-camera',
      { cameraPermission: 'Cho phep Adsup dung camera cho cham cong va anh chung minh.' },
    ],
    'expo-secure-store',
    'expo-notifications',
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.adsup.mobile',
  },
  android: {
    package: 'com.adsup.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/brand/adsup-logo.png',
      backgroundColor: '#F5F8FC',
    },
  },
  extra: {
    apiBaseUrl:
      typeof (process.env as unknown as Record<string, unknown>).EXPO_PUBLIC_API_BASE_URL ===
      'string'
        ? (process.env as unknown as Record<string, string>).EXPO_PUBLIC_API_BASE_URL
        : 'http://localhost:3000',
  },
};

export default config;
