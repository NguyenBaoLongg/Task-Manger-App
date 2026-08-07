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

export const signInWithProvider = async (
  provider: GoogleProvider,
  client: ApiClient,
  idempotencyKey: string,
): Promise<AuthResult> => {
  const identity = await provider.signIn();
  const response = await client.request<BackendAuthResponse>('/v1/auth/google', {
    method: 'POST',
    body: { idToken: identity.idToken },
    idempotencyKey,
  });
  return normalizeAuthResponse(response) as AuthResult;
};
