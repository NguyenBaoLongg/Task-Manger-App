import { getRuntimeConfig } from '@/config/runtime-config';
import { NativeModules } from 'react-native';

const modules = NativeModules as Record<string, unknown>;
const originalRuntimeModule = modules.AdsupRuntime;

describe('getRuntimeConfig', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    modules.AdsupRuntime = originalRuntimeModule;
  });

  it('normalizes the API base URL from the environment', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';

    expect(getRuntimeConfig()).toEqual({ apiBaseUrl: 'http://localhost:3000' });
  });

  it('rejects a missing API base URL', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(() => getRuntimeConfig()).toThrow('EXPO_PUBLIC_API_BASE_URL is required');
  });

  it('uses the native releaseE2e emulator-NAT URL before an inlined loopback URL', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    modules.AdsupRuntime = { testApiBaseUrl: 'http://10.0.2.2:3000' };

    expect(getRuntimeConfig()).toEqual({ apiBaseUrl: 'http://10.0.2.2:3000' });
  });
});
