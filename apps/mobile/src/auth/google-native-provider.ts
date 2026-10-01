import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import type { GoogleAuthResult, GoogleProvider } from './google-provider';

export type GoogleNativeConfig = {
  clientId: string;
};

export const createGoogleNativeProvider = (config: GoogleNativeConfig): GoogleProvider => {
  const { clientId } = config;

  return {
    async signIn(): Promise<GoogleAuthResult> {
      GoogleSignin.configure({ webClientId: clientId });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response) || !isSuccessResponse(response)) {
        return { cancelled: true };
      }
      const { data } = response;
      const idToken = data.idToken ?? (await GoogleSignin.getTokens()).idToken;
      if (!idToken) throw new Error('Google không trả về mã đăng nhập. Hãy thử lại.');
      return {
        idToken,
        email: data.user.email ?? undefined,
        displayName: data.user.name ?? undefined,
      };
    },
    async signOut() {
      try {
        await GoogleSignin.signOut();
      } catch {
        // not signed in
      }
    },
  };
};
