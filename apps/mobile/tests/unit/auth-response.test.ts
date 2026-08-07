import { normalizeAuthResponse, toSessionTokens } from '@/features/auth/auth-response';

const response = {
  user: { profileComplete: true },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessExpiresAt: '2026-07-26T07:00:00.000Z',
  refreshExpiresAt: '2026-08-26T07:00:00.000Z',
};

describe('backend auth response adapter', () => {
  it('maps the published nested profile and access expiry fields', () => {
    expect(normalizeAuthResponse(response)).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.parse(response.accessExpiresAt),
      profileComplete: true,
    });
  });

  it('maps refresh responses to the secure session shape', () => {
    expect(toSessionTokens(response)).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.parse(response.accessExpiresAt),
    });
  });
});
