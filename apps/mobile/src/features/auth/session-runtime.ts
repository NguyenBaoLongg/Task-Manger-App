import { createApiClient } from '@/api/api-client';
import { getRuntimeConfig } from '@/config/runtime-config';
import { createSecureSessionStorage } from '@/auth/secure-session-storage';
import { createSessionCoordinator } from '@/auth/session-coordinator';
import { createWorkspaceSelectionStorage } from '@/tenant/workspace-selection-storage';
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
    refresh: (refreshToken, idempotencyKey) =>
      publicClient
        .request<BackendAuthResponse>('/v1/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
          idempotencyKey,
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
    // Access tokens only live 15 minutes; a 401 means the token expired while the
    // app was open, so refresh once and retry the request transparently.
    refreshAccessToken: () => session.refreshIfNeeded(true).catch(() => undefined),
  });
};

/**
 * Whether a stored session exists, without building an API client. The entry screen needs this to
 * decide between sign-in and a workspace restore before it can make any authenticated call.
 */
export const getStoredSession = async (): Promise<boolean> => {
  const session = getCoordinator();
  await session.load();
  return session.getAccessToken() !== undefined;
};

export const clearSession = async () => {
  await getCoordinator().logout();
  await createWorkspaceSelectionStorage().clear();
};
export const getSessionAccessToken = () => coordinator?.getAccessToken();
