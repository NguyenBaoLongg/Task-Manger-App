import * as AuthSession from 'expo-auth-session';
import type { GoogleAuthResult, GoogleProvider } from './google-provider';

export type GoogleAuthSessionConfig = {
  clientId: string;
};

const GOOGLE_DISCOVERY = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' };

/**
 * Android OAuth clients only accept the AppAuth-style redirect that Google pre-registers for
 * them. A custom scheme (e.g. `adsup:/oauthredirect`) fails Google's OAuth 2.0 security policy
 * ("app doesn't comply") because Google cannot bind the scheme to the app.
 */
const googleRedirectUri = (clientId: string) =>
  `com.googleusercontent.apps.${clientId}:/oauth2redirect`;

const randomNonce = (): string => {
  const bytes = new Uint8Array(16);
  const getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (getRandomValues) {
    getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const createGoogleAuthProvider = (config: GoogleAuthSessionConfig): GoogleProvider => {
  const { clientId } = config;

  return {
    async signIn(): Promise<GoogleAuthResult> {
      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri: googleRedirectUri(clientId),
        responseType: AuthSession.ResponseType.IdToken,
        scopes: ['openid', 'email', 'profile'],
        // Google rejects code_challenge params ("Parameter not allowed for this message type")
        // for native Android OAuth clients; PKCE only applies to server-side code exchange.
        usePKCE: false,
        extraParams: { nonce: randomNonce() },
      });
      const result = await request.promptAsync(GOOGLE_DISCOVERY);
      if (result.type !== 'success') return { cancelled: true };
      const idToken = result.params.id_token;
      if (!idToken) throw new Error('Google không trả về mã đăng nhập. Hãy thử lại.');
      return { idToken, email: result.params.email, displayName: result.params.name };
    },
    async signOut() {
      AuthSession.dismiss();
    },
  };
};
