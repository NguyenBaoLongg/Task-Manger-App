import { by, device, element, expect } from 'detox';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readDetoxEnv, signInToDashboard, tapId, waitForId } from './helpers';

const APP_ID = 'com.adsup.mobile';

/**
 * Detox installs the Android app with all runtime permissions granted, so the camera-denied
 * surface this test is named for never renders unless the permission is revoked first. Detox's
 * `launchApp({ permissions })` option is iOS-only, so Android has to go through adb.
 *
 * Revoking kills the app process, so the relaunch that follows must not reinstall — a reinstall
 * would grant the permission back and put the test straight into the camera preview.
 */
const revokeCameraPermission = () => {
  if (device.getPlatform() !== 'android') return;

  const sdkRoot = readDetoxEnv('ANDROID_HOME') || readDetoxEnv('ANDROID_SDK_ROOT');
  const adb = sdkRoot ? join(sdkRoot, 'platform-tools', 'adb') : 'adb';

  execFileSync(adb, [
    '-s',
    device.id,
    'shell',
    'pm',
    'revoke',
    APP_ID,
    'android.permission.CAMERA',
  ]);
};

describe('attendance and approval smoke', () => {
  it('covers camera-denied entry, leave submission and approval decision surfaces', async () => {
    revokeCameraPermission();
    await signInToDashboard({ 'ui-test-profile': 'US3_ATTENDANCE_APPROVAL' }, { delete: false });

    await tapId('dashboard.attendance-button');
    await waitForId('attendance.screen');
    await tapId('attendance.video-button');
    await expect(await waitForId('attendance.video.permission')).toBeVisible();
    await expect(await waitForId('attendance.video.allow-camera')).toBeVisible();

    await signInToDashboard({ 'ui-test-profile': 'US3_LEAVE_SUBMISSION' });
    await tapId('dashboard.approvals-button');
    await waitForId('approval.request.screen');
    await element(by.id('approval.request.reason')).replaceText('Seeded leave smoke');
    await expect(element(by.id('approval.request.reason'))).toHaveText('Seeded leave smoke');

    const seededApprovalId = readDetoxEnv('DETOX_SEEDED_APPROVAL_ID');
    if (seededApprovalId.length > 0) {
      await device.openURL({ url: `adsup://approvals/${seededApprovalId}` });
      await waitForId('approval.detail.screen');
      await element(by.id('approval.detail.reason')).replaceText('Approved by smoke test');
      await expect(await waitForId('approval.detail.approve')).toBeVisible();
    }
  });
});
