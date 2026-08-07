import { getPlatformCapabilities } from '@/notifications/platform-capabilities';
describe('native capability fallback', () => {
  it('supports iOS/Android actions and a safe fallback elsewhere', () => {
    expect(getPlatformCapabilities('ios').lockScreenActions).toBe(true);
    expect(getPlatformCapabilities('ios').actionIdentifiers.ARRIVED_PROOF).toBe(
      'com.adsup.action.ARRIVED_PROOF',
    );
    expect(getPlatformCapabilities('android').lockScreenActions).toBe(true);
    expect(getPlatformCapabilities('android').actionIdentifiers.CANCEL_OR_RESCHEDULE).toBe(
      'ADSUP_CANCEL_OR_RESCHEDULE',
    );
    expect(getPlatformCapabilities('web')).toMatchObject({
      fallbackRoute: '/notifications',
      lockScreenActions: false,
    });
  });
});
