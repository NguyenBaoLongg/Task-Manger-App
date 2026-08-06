export type BackendAuthResponse = {
  user?: { profileComplete?: boolean };
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt?: string;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const parseExpiry = (value: string) => {
  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt)) throw new Error('INVALID_AUTH_RESPONSE');
  return expiresAt;
};

export const toSessionTokens = (response: BackendAuthResponse): SessionTokens => ({
  accessToken: response.accessToken,
  refreshToken: response.refreshToken,
  expiresAt: parseExpiry(response.accessExpiresAt),
});

export const normalizeAuthResponse = (response: BackendAuthResponse) => ({
  ...toSessionTokens(response),
  profileComplete: response.user?.profileComplete === true,
});
