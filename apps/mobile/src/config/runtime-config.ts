import Constants from 'expo-constants';

export type RuntimeConfig = {
  apiBaseUrl: string;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/$/, '');

export const getRuntimeConfig = (): RuntimeConfig => {
  const extraValue: unknown = Constants.expoConfig?.extra;
  const extra =
    typeof extraValue === 'object' && extraValue !== null
      ? (extraValue as { apiBaseUrl?: unknown })
      : undefined;
  const envValue: unknown = (process.env as unknown as Record<string, unknown>)
    .EXPO_PUBLIC_API_BASE_URL;
  const apiBaseUrl =
    typeof envValue === 'string'
      ? envValue
      : typeof extra?.apiBaseUrl === 'string'
        ? extra.apiBaseUrl
        : undefined;

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
  }

  return { apiBaseUrl: normalizeBaseUrl(apiBaseUrl) };
};
