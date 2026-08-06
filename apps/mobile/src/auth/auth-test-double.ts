import type { GoogleProvider } from './google-provider';

export const createAuthTestDouble = (result: { idToken?: string } = {}): GoogleProvider => ({
  signIn: async () => ({
    idToken: result.idToken ?? 'dev-google:local-mobile-user:mobile@adsup.local',
  }),
  signOut: async () => undefined,
});
