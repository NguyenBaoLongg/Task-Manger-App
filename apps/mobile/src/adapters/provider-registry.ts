export type ProviderRegistry = {
  auth: 'local-double' | 'google';
  notifications: 'local-double' | 'fcm' | 'apns';
  storage: 'local-double' | 's3-compatible';
  camera: 'native' | 'local-double';
};

export const providerRegistry: ProviderRegistry = {
  auth: 'local-double',
  notifications: 'local-double',
  storage: 'local-double',
  camera: 'local-double',
};

export const createLocalAuthDouble = () => ({
  signIn: async () => ({ idToken: 'local-google-id-token-0000000000' }),
  signOut: async () => undefined,
});

export const createLocalCameraDouble = () => ({
  captureVideo: async () => ({ uri: 'file://local/check-in.mp4', durationMs: 3_000 }),
});

export const createLocalNotificationDouble = () => ({
  register: async (token: string) => ({ endpointId: 'local-endpoint', token }),
  revoke: async () => undefined,
});

export const createLocalStorageDouble = () => ({
  upload: async (mediaId: string, bytes: Uint8Array) => ({
    mediaId,
    checksum: Array.from(bytes)
      .reduce((sum, byte) => (sum + byte) % 65536, 0)
      .toString(16),
  }),
});
