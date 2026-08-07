import { getRuntimeConfig } from '@/config/runtime-config';

describe('getRuntimeConfig', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  it('normalizes the API base URL from the environment', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';

    expect(getRuntimeConfig()).toEqual({ apiBaseUrl: 'http://localhost:3000' });
  });

  it('rejects a missing API base URL', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(() => getRuntimeConfig()).toThrow('EXPO_PUBLIC_API_BASE_URL is required');
  });
});
