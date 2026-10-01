import { execSync } from 'child_process';
import { by, device, element, waitFor } from 'detox';
import { emitDetoxMetric, readDetoxEnv, tapId, waitForId, VISIBILITY_TIMEOUT_MS } from './helpers';

/**
 * TEMPORARY evidence spec for quickstart scenario 3 (on-device walk). Runs once to capture
 * CR-005 / SC-002 measurements and FR-006 / FR-007 / error-message evidence, then the file is
 * removed. Not part of the standing 8-suite matrix (T032).
 */
const API_BASE = `http://127.0.0.1:${process.env.ADSUP_E2E_API_PORT ?? 3000}`;
const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const ADB_NAME = readDetoxEnv('DETOX_ANDROID_PHONE_ADB_NAME') || '127.0.0.1:5555';

type AuthResult = { accessToken: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const apiRequest = async (
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string; idempotencyKey?: string } = {},
): Promise<unknown> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
      ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    throw new Error(`API ${options.method ?? 'POST'} ${path} failed: ${response.status}`);
  }
  if (response.status === 204) return undefined;
  return (await response.json()) as unknown;
};

const signInAsSubject = async (subject: string): Promise<string> => {
  const auth = (await apiRequest('/v1/auth/google', {
    body: { idToken: `dev-google:${subject}:${subject}@adsup.local` },
    idempotencyKey: `sc3-auth-${subject}-${Date.now()}`,
  })) as AuthResult;
  return auth.accessToken;
};

const confirmProfile = async (accessToken: string, fullName: string): Promise<void> => {
  await apiRequest('/v1/me', {
    method: 'PATCH',
    accessToken,
    body: { fullName },
    idempotencyKey: `sc3-profile-${Date.now()}`,
  });
};

const createInvitationToken = async (accessToken: string): Promise<string> => {
  const roles = (await apiRequest(`/v1/tenants/${TENANT_ID}/roles`, {
    method: 'GET',
    accessToken,
  })) as { id: string; code: string }[];
  const employee = roles.find((role) => role.code === 'EMPLOYEE');
  if (!employee) throw new Error('Seeded EMPLOYEE role missing');
  const invitation = (await apiRequest(`/v1/tenants/${TENANT_ID}/invitations`, {
    body: {
      type: 'DIRECT',
      roleId: employee.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessToken,
    idempotencyKey: `sc3-invite-${Date.now()}`,
  })) as { token: string };
  return invitation.token;
};

const signInThroughWorkspace = async () => {
  await tapId('auth.sign-in');
  await tapId('workspace.option');
  await tapId('branch.option');
  await waitForId('dashboard.screen');
};

const measureLaunchToSignIn = async () => {
  const launchStartedAt = Date.now();
  await waitForId('auth.sign-in');
  emitDetoxMetric('LAUNCH_TO_SIGNIN_TOTAL_MS', { ms: Date.now() - launchStartedAt });
};

describe('scenario 3 on-device evidence', () => {
  it('owner sees the Google sign-in button and the invite entry (FR-006, CR-005)', async () => {
    await device.launchApp({
      delete: true,
      launchArgs: { 'ui-test-metric': 'CR-005' },
      newInstance: true,
    });
    // CR-005: the native module logs the true process-start -> sign-in-actionable duration to
    // logcat (ADSUP_CR005); this wall-clock number is Detox-inflated evidence only.
    await measureLaunchToSignIn();

    await signInThroughWorkspace();
    await tapId('tab.workspace');
    await waitForId('workspace.screen');
    await waitFor(element(by.id('workspace.invite-panel')).atIndex(0))
      .toBeVisible()
      .withTimeout(VISIBILITY_TIMEOUT_MS);
  });

  it('a member without member.invite does not see the invite entry (FR-007)', async () => {
    const ownerToken = await signInAsSubject('local-mobile-user');
    const invitationToken = await createInvitationToken(ownerToken);
    const subject = `sc3-employee-${Date.now()}`;
    const employeeToken = await signInAsSubject(subject);
    await confirmProfile(employeeToken, 'Nhân Viên SC3');
    await apiRequest('/v1/invitations/accept', {
      body: { token: invitationToken },
      accessToken: employeeToken,
      idempotencyKey: `sc3-accept-${subject}-${Date.now()}`,
    });

    await device.launchApp({
      delete: true,
      launchArgs: { 'ui-test-google-subject': subject },
      newInstance: true,
    });
    await measureLaunchToSignIn();
    await tapId('auth.sign-in');
    await tapId('workspace.option');
    await tapId('branch.option');
    // A freshly invited employee has no branch assignment yet, so the dashboard renders its
    // error state; the tab bar still mounts and the workspace tab remains reachable.
    await waitForId('tab.workspace', { timeout: VISIBILITY_TIMEOUT_MS });
    await tapId('tab.workspace');
    await waitForId('workspace.screen');
    await waitFor(element(by.id('workspace.invite-panel')).atIndex(0))
      .toBeNotVisible()
      .withTimeout(VISIBILITY_TIMEOUT_MS);
  });

  it('an invalid invitation code shows a Vietnamese error on the join screen (FR-010)', async () => {
    const subject = `sc3-invalid-${Date.now()}`;
    const token = await signInAsSubject(subject);
    await confirmProfile(token, 'Người Nhập Sai Mã');

    await device.launchApp({
      delete: true,
      launchArgs: { 'ui-test-google-subject': subject },
      newInstance: true,
    });
    await measureLaunchToSignIn();
    await tapId('auth.sign-in');
    await waitForId('workspace.join-company');
    await tapId('workspace.join-company');
    await waitForId('join-company.screen');
    await element(by.id('join-company.code')).replaceText('MA-KHONG-TON-TAI');
    await tapId('join-company.submit');
    await waitFor(
      element(by.text(/Lời mời không còn hiệu lực.*|Mã lời mời không hợp lệ.*/)).atIndex(0),
    )
      .toBeVisible()
      .withTimeout(VISIBILITY_TIMEOUT_MS);
  });

  it('owner creates an invitation, sees the code and expiry, and shares it (FR-005, FR-006, SC-002)', async () => {
    // Fresh install without a subject override: the BuildConfig default subject is the seeded
    // owner. This test runs last because the OS share sheet pauses the app and never lets Detox
    // observe the JS timers draining again; the sheet is therefore driven at the OS level.
    await device.launchApp({ delete: true, launchArgs: {}, newInstance: true });
    await signInThroughWorkspace();
    await tapId('tab.workspace');
    await waitForId('workspace.screen');
    await tapId('workspace.invite-member');
    await waitForId('invite-member.screen');
    await waitForId('invite-member.role');
    await tapId('invite-member.role');

    const createStartedAt = Date.now();
    await tapId('invite-member.create');
    await waitForId('invite-member.code');
    emitDetoxMetric('INVITE_CREATE_MS', { ms: Date.now() - createStartedAt });

    await waitFor(element(by.text(/Hạn: .+/)).atIndex(0))
      .toBeVisible()
      .withTimeout(VISIBILITY_TIMEOUT_MS);

    // Fire the share tap without awaiting its post-tap idle wait: opening the OS share sheet
    // pauses the app so the idling-resource never drains and the awaited action would hang.
    const shareTap = element(by.id('invite-member.share')).tap();
    void shareTap.catch(() => undefined);
    await sleep(2500);
    execSync(`adb -s ${ADB_NAME} exec-out screencap -p > C:/adsup-e2e/sc3-share-sheet.png`);
    execSync(`adb -s ${ADB_NAME} shell input keyevent KEYCODE_BACK`);
    await sleep(1000);
    // Killing the app unwinds the hung idle wait so the worker stays usable for the next suite.
    execSync(`adb -s ${ADB_NAME} shell am force-stop com.adsup.mobile`);
    await sleep(3000);
  });
});
