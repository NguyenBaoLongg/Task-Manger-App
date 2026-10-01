import type { createApiClient } from '@/api/api-client';
import type { GoogleProvider } from '@/auth/google-provider';
import { normalizeAuthResponse, type BackendAuthResponse } from './auth-response';

type ApiClient = ReturnType<typeof createApiClient>;
type AuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  profileComplete: boolean;
};

export type SignInOutcome = AuthResult | 'cancelled';

export const signInWithProvider = async (
  provider: GoogleProvider,
  client: ApiClient,
  idempotencyKey: string,
): Promise<SignInOutcome> => {
  const identity = await provider.signIn();
  if (identity.cancelled || !identity.idToken) return 'cancelled';
  const response = await client.request<BackendAuthResponse>('/v1/auth/google', {
    method: 'POST',
    body: { idToken: identity.idToken },
    idempotencyKey,
  });
  return normalizeAuthResponse(response) as AuthResult;
};
