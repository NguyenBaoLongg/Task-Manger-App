import { createApiClient } from '@/api/api-client';
import { getRuntimeConfig } from '@/config/runtime-config';
import { createSecureSessionStorage } from '@/auth/secure-session-storage';
import { createSessionCoordinator } from '@/auth/session-coordinator';
import { toSessionTokens, type BackendAuthResponse } from './auth-response';

const storage = createSecureSessionStorage();
let coordinator: ReturnType<typeof createSessionCoordinator> | undefined;

const getCoordinator = () => {
  if (coordinator) return coordinator;
  const publicClient = createApiClient({
    baseUrl: getRuntimeConfig().apiBaseUrl,
    getAccessToken: () => undefined,
  });
  coordinator = createSessionCoordinator({
    storage,
    refresh: (refreshToken) =>
      publicClient
        .request<BackendAuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        })
        .then(toSessionTokens),
  });
  return coordinator;
};

export const saveSession = async (tokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}) => {
  await getCoordinator().set(tokens);
};

export const getAuthenticatedClient = async () => {
  const session = getCoordinator();
  await session.load();
  return createApiClient({
    baseUrl: getRuntimeConfig().apiBaseUrl,
    getAccessToken: session.getAccessToken,
  });
};

export const clearSession = () => getCoordinator().logout();
export const getSessionAccessToken = () => coordinator?.getAccessToken();
