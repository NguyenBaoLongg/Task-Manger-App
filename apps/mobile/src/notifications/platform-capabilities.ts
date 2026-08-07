import type { NativeBookingAction } from './native-action-handler';

export type PlatformCapabilities = {
  actionIdentifiers: Record<NativeBookingAction, string>;
  lockScreenActions: boolean;
  fallbackRoute: string;
};

export const getPlatformCapabilities = (platform: string): PlatformCapabilities => ({
  actionIdentifiers: {
    ARRIVED_PROOF: platform === 'ios' ? 'com.adsup.action.ARRIVED_PROOF' : 'ADSUP_ARRIVED_PROOF',
    CANCEL_OR_RESCHEDULE:
      platform === 'ios' ? 'com.adsup.action.CANCEL_OR_RESCHEDULE' : 'ADSUP_CANCEL_OR_RESCHEDULE',
  },
  lockScreenActions: platform === 'ios' || platform === 'android',
  fallbackRoute: '/notifications',
});
