import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { createGoogleNativeProvider } from '@/auth/google-native-provider';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    getTokens: jest.fn(async () => ({ idToken: 'id-token-1', accessToken: 'access-1' })),
    getCurrentUser: jest.fn(() => null),
    signOut: jest.fn(async () => null),
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
  isCancelledResponse: (response: { type: string }) => response.type === 'cancelled',
}));

const signinMock = GoogleSignin as unknown as {
  configure: jest.Mock;
  hasPlayServices: jest.Mock;
  signIn: jest.Mock;
  getTokens: jest.Mock;
  signOut: jest.Mock;
};

const successResponse = (data: Record<string, unknown>) => ({ type: 'success', data });

describe('google-native-provider', () => {
  afterEach(() => {
    signinMock.configure.mockClear();
    signinMock.hasPlayServices.mockClear();
    signinMock.signIn.mockReset();
    signinMock.getTokens.mockClear();
    signinMock.signOut.mockClear();
  });

  it('configures the web client id and returns the user from a successful sign-in', async () => {
    signinMock.signIn.mockResolvedValueOnce(
      successResponse({
        idToken: 'id-token-1',
        user: { email: 'lan@adsup.vn', name: 'Lan' },
      }),
    );

    const result = await createGoogleNativeProvider({ clientId: 'client-123' }).signIn();

    expect(signinMock.configure).toHaveBeenCalledWith({ webClientId: 'client-123' });
    expect(signinMock.hasPlayServices).toHaveBeenCalled();
    expect(result).toEqual({
      idToken: 'id-token-1',
      email: 'lan@adsup.vn',
      displayName: 'Lan',
    });
  });

  it('treats a cancelled credential picker as a clean cancel', async () => {
    signinMock.signIn.mockResolvedValueOnce({ type: 'cancelled' });

    const result = await createGoogleNativeProvider({ clientId: 'client-123' }).signIn();

    expect(result.cancelled).toBe(true);
    expect(result.idToken).toBeUndefined();
  });

  it('falls back to getTokens when the sign-in payload has no id token', async () => {
    signinMock.signIn.mockResolvedValueOnce(successResponse({ idToken: null, user: { email: 'lan@adsup.vn' } }));

    const result = await createGoogleNativeProvider({ clientId: 'client-123' }).signIn();

    expect(result.idToken).toBe('id-token-1');
    expect(signinMock.getTokens).toHaveBeenCalled();
  });

  it('swallows sign-out failures', async () => {
    signinMock.signOut.mockRejectedValueOnce(new Error('no user'));

    await expect(createGoogleNativeProvider({ clientId: 'client-123' }).signOut()).resolves.toBeUndefined();
  });
});
