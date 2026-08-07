import { by, device, element, expect } from 'detox';
import { readDetoxEnv, signInToDashboard, tapId, waitForId } from './helpers';

describe('attendance and approval smoke', () => {
  it('covers camera-denied entry, leave submission and approval decision surfaces', async () => {
    await signInToDashboard({ 'ui-test-profile': 'US3_ATTENDANCE_APPROVAL' });

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
