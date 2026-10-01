import type { GoogleProvider } from './google-provider';
import { getE2eGoogleSubject } from '@/native/adsup-runtime';

export const createAuthTestDouble = (result: { idToken?: string } = {}): GoogleProvider => ({
  signIn: async () => {
    const subject = (await getE2eGoogleSubject()) ?? 'local-mobile-user';
    return {
      idToken: result.idToken ?? `dev-google:${subject}:${subject}@adsup.local`,
    };
  },
  signOut: async () => undefined,
});
