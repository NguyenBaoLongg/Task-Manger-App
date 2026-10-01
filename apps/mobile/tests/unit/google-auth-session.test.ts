import { NativeModules, Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { createGoogleAuthProvider } from '@/auth/google-auth-session';
import { createGoogleNativeProvider } from '@/auth/google-native-provider';
import { createGoogleProvider } from '@/auth/provider-factory';

jest.mock('expo-auth-session', () => {
  const promptAsync = jest.fn();
  const AuthRequest = jest.fn(function AuthRequest(this: Record<string, unknown>, config: unknown) {
    this.config = config;
    this.promptAsync = promptAsync;
  });
  return {
    AuthRequest,
    ResponseType: { IdToken: 'id_token' },
    makeRedirectUri: jest.fn(() => 'adsup:/oauthredirect'),
    promptAsync,
  };
});

jest.mock('@/auth/google-native-provider', () => ({
  createGoogleNativeProvider: jest.fn(() => ({ signIn: jest.fn(), signOut: jest.fn() })),
}));

const authSessionMock = AuthSession as unknown as {
  AuthRequest: jest.Mock;
  promptAsync: jest.Mock;
  makeRedirectUri: jest.Mock;
};

const modules = NativeModules as Record<string, unknown>;
const originalRuntimeModule = modules.AdsupRuntime;

const successResult = (params: Record<string, string>) => ({
  type: 'success',
  params,
  url: 'adsup:/oauthredirect#id_token=x',
  errorCode: null,
  authentication: null,
});

describe('google-auth-session production provider', () => {
  afterEach(() => {
    authSessionMock.promptAsync.mockReset();
    authSessionMock.AuthRequest.mockClear();
  });

  it('requests an id_token with nonce and openid scopes', async () => {
    authSessionMock.promptAsync.mockResolvedValueOnce(
      successResult({ id_token: 'google-id-token', email: 'lan@adsup.vn', name: 'Lan' }),
    );

    const result = await createGoogleAuthProvider({ clientId: 'client-123' }).signIn();

    expect(result).toEqual({
      idToken: 'google-id-token',
      email: 'lan@adsup.vn',
      displayName: 'Lan',
    });
    const config = authSessionMock.AuthRequest.mock.instances[0].config as Record<string, unknown>;
    expect(config.clientId).toBe('client-123');
    expect(config.responseType).toBe('id_token');
    expect(config.scopes).toEqual(['openid', 'email', 'profile']);
    expect(config.redirectUri).toBe('com.googleusercontent.apps.client-123:/oauth2redirect');
    expect(config.usePKCE).toBe(false);
    const extraParams = config.extraParams as Record<string, string>;
    expect(extraParams.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(authSessionMock.promptAsync).toHaveBeenCalledWith({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    });
  });

  it('treats a cancelled account picker as a clean cancel', async () => {
    authSessionMock.promptAsync.mockResolvedValueOnce({ type: 'cancel' });

    const result = await createGoogleAuthProvider({ clientId: 'client-123' }).signIn();

    expect(result.cancelled).toBe(true);
    expect(result.idToken).toBeUndefined();
  });

  it('rejects when Google succeeds without an id_token', async () => {
    authSessionMock.promptAsync.mockResolvedValueOnce(successResult({}));

    await expect(createGoogleAuthProvider({ clientId: 'client-123' }).signIn()).rejects.toThrow(
      'Google không trả về mã đăng nhập',
    );
  });
});

describe('provider factory', () => {
  afterEach(() => {
    modules.AdsupRuntime = originalRuntimeModule;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    authSessionMock.promptAsync.mockReset();
    authSessionMock.AuthRequest.mockClear();
    (createGoogleNativeProvider as jest.Mock).mockClear();
    jest.restoreAllMocks();
  });

  it('keeps the test double on the releaseE2e build', async () => {
    modules.AdsupRuntime = { testApiBaseUrl: 'http://10.0.2.2:3000', googleForceReal: false };

    const result = await createGoogleProvider().signIn();

    expect(result.idToken).toMatch(/^dev-google:[^:]+:[^:]+$/);
    expect(authSessionMock.AuthRequest).not.toHaveBeenCalled();
  });

  it('uses the production provider when a releaseE2e build forces real Google', async () => {
    modules.AdsupRuntime = { testApiBaseUrl: 'http://10.0.2.2:3000', googleForceReal: true };
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'client-789';
    authSessionMock.promptAsync.mockResolvedValueOnce(successResult({ id_token: 'token-789' }));

    await createGoogleProvider().signIn();

    const config = authSessionMock.AuthRequest.mock.instances[0].config as Record<string, unknown>;
    expect(config.clientId).toBe('client-789');
  });

  it('builds the production provider when a client id is configured', async () => {
    modules.AdsupRuntime = {};
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'client-456';
    authSessionMock.promptAsync.mockResolvedValueOnce(successResult({ id_token: 'token-456' }));

    await createGoogleProvider().signIn();

    const config = authSessionMock.AuthRequest.mock.instances[0].config as Record<string, unknown>;
    expect(config.clientId).toBe('client-456');
  });

  it('throws a clear configuration error when the client id is missing', () => {
    modules.AdsupRuntime = {};
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

    expect(() => createGoogleProvider()).toThrow('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
  });

  it('uses the native GMS provider on Android instead of the browser flow', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    modules.AdsupRuntime = {};
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'client-android';
    const nativeFactory = createGoogleNativeProvider as jest.Mock;
    const signIn = jest.fn();
    nativeFactory.mockReturnValue({ signIn, signOut: jest.fn() });

    const provider = createGoogleProvider();
    await provider.signIn();

    expect(nativeFactory).toHaveBeenCalledWith({ clientId: 'client-android' });
    expect(signIn).toHaveBeenCalled();
    expect(authSessionMock.AuthRequest).not.toHaveBeenCalled();
  });
});
