import * as SecureStore from 'expo-secure-store';

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const SESSION_KEY = 'adsup.mobile.session.v1';

export const createSecureSessionStorage = () => ({
  async load(): Promise<SessionTokens | undefined> {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    if (!value) return undefined;
    try {
      return JSON.parse(value) as SessionTokens;
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return undefined;
    }
  },
  save(value: SessionTokens): Promise<void> {
    return SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value));
  },
  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(SESSION_KEY);
  },
});
