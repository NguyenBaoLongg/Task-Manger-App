import {
  createLocalAuthDouble,
  createLocalCameraDouble,
  createLocalNotificationDouble,
  createLocalStorageDouble,
} from '@/adapters/provider-registry';

describe('local provider adapters', () => {
  it('provides deterministic doubles without production credentials', async () => {
    const auth = createLocalAuthDouble();
    const camera = createLocalCameraDouble();
    const notifications = createLocalNotificationDouble();
    const storage = createLocalStorageDouble();
    const authResult = await auth.signIn();
    const videoResult = await camera.captureVideo();
    const notificationResult = await notifications.register('token');
    const uploadResult = await storage.upload('media-1', new Uint8Array([1, 2]));
    expect(typeof authResult.idToken).toBe('string');
    expect(videoResult.uri).toContain('file://');
    expect(notificationResult).toEqual({ endpointId: 'local-endpoint', token: 'token' });
    expect(uploadResult.mediaId).toBe('media-1');
    expect(uploadResult.checksum).toEqual(expect.any(String));
  });
});
