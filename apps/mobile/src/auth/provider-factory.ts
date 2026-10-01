import { Platform } from 'react-native';
import { getRuntimeConfig } from '@/config/runtime-config';
import { getReleaseE2eApiBaseUrl, isGoogleForceReal } from '@/native/adsup-runtime';
import { createAuthTestDouble } from './auth-test-double';
import { createGoogleAuthProvider } from './google-auth-session';
import { createGoogleNativeProvider } from './google-native-provider';
import type { GoogleProvider } from './google-provider';

export const createGoogleProvider = (): GoogleProvider => {
  if (getReleaseE2eApiBaseUrl() && !isGoogleForceReal()) return createAuthTestDouble();
  const { googleClientId } = getRuntimeConfig();
  if (!googleClientId) {
    throw new Error(
      'Chưa cấu hình đăng nhập Google. Hãy đặt EXPO_PUBLIC_GOOGLE_CLIENT_ID rồi khởi động lại app.',
    );
  }
  // Google đã ngừng hỗ trợ custom URI scheme cho OAuth client Android;
  // luồng trình duyệt luôn bị redirect_uri_mismatch nên Android dùng SDK GMS.
  if (Platform.OS === 'android') return createGoogleNativeProvider({ clientId: googleClientId });
  return createGoogleAuthProvider({ clientId: googleClientId });
};
