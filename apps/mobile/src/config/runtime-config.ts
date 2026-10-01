import Constants from 'expo-constants';
import { getReleaseE2eApiBaseUrl } from '@/native/adsup-runtime';

export type RuntimeConfig = {
  apiBaseUrl: string;
  googleClientId?: string;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/$/, '');

export const getRuntimeConfig = (): RuntimeConfig => {
  const extraValue: unknown = Constants.expoConfig?.extra;
  const extra =
    typeof extraValue === 'object' && extraValue !== null
      ? (extraValue as { apiBaseUrl?: unknown; googleClientId?: unknown })
      : undefined;
  const envValue: unknown = (process.env as unknown as Record<string, unknown>)
    .EXPO_PUBLIC_API_BASE_URL;
  const googleClientIdValue: unknown = (process.env as unknown as Record<string, unknown>)
    .EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const releaseE2eApiBaseUrl = getReleaseE2eApiBaseUrl();
  const apiBaseUrl =
    releaseE2eApiBaseUrl ??
    (typeof envValue === 'string'
      ? envValue
      : typeof extra?.apiBaseUrl === 'string'
        ? extra.apiBaseUrl
        : undefined);

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
  }

  const googleClientId =
    typeof googleClientIdValue === 'string'
      ? googleClientIdValue
      : typeof extra?.googleClientId === 'string'
        ? extra.googleClientId
        : undefined;

  return { apiBaseUrl: normalizeBaseUrl(apiBaseUrl), googleClientId };
};
